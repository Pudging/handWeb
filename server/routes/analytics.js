import express from 'express';
import { body, validationResult } from 'express-validator';
import Deck from '../models/Deck.js';
import Card from '../models/Card.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateAnalytics } from '../middleware/validation.js';

const router = express.Router();

// @route   GET /api/analytics/dashboard
// @desc    Get user analytics dashboard data
// @access  Private
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's deck statistics
    const userDecks = await Deck.find({ owner: userId });
    
    const deckStats = {
      totalDecks: userDecks.length,
      publicDecks: userDecks.filter(d => d.isPublic).length,
      totalViews: userDecks.reduce((sum, d) => sum + d.views, 0),
      averageWinRate: 0,
      totalGames: 0,
      totalWins: 0,
      totalLosses: 0
    };

    if (userDecks.length > 0) {
      const totalWinRate = userDecks.reduce((sum, d) => sum + (d.performance?.winRate || 0), 0);
      deckStats.averageWinRate = Math.round(totalWinRate / userDecks.length * 10) / 10;
      deckStats.totalGames = userDecks.reduce((sum, d) => sum + (d.performance?.totalGames || 0), 0);
      deckStats.totalWins = userDecks.reduce((sum, d) => sum + (d.performance?.wins || 0), 0);
      deckStats.totalLosses = userDecks.reduce((sum, d) => sum + (d.performance?.losses || 0), 0);
    }

    // Get recent simulation results
    const recentSimulations = userDecks
      .flatMap(d => d.simulations.map(s => ({ ...s.toObject(), deckName: d.name, deckId: d._id })))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    // Get popular archetypes
    const archetypeCounts = {};
    userDecks.forEach(deck => {
      if (deck.archetype) {
        archetypeCounts[deck.archetype] = (archetypeCounts[deck.archetype] || 0) + 1;
      }
    });

    const topArchetypes = Object.entries(archetypeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([archetype, count]) => ({ archetype, count }));

    // Get performance trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentDecks = userDecks.filter(d => d.lastUpdated >= thirtyDaysAgo);
    const recentPerformance = recentDecks.length > 0 
      ? recentDecks.reduce((sum, d) => sum + (d.performance?.winRate || 0), 0) / recentDecks.length
      : 0;

    res.json({
      success: true,
      analytics: {
        deckStats,
        recentSimulations,
        topArchetypes,
        recentPerformance: Math.round(recentPerformance * 10) / 10,
        totalCards: userDecks.reduce((sum, d) => sum + d.main.length, 0)
      }
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting dashboard'
    });
  }
});

// @route   GET /api/analytics/deck/:id
// @desc    Get detailed analytics for a specific deck
// @access  Private (owner only)
router.get('/deck/:id', authenticateToken, async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);
    if (!deck) {
      return res.status(404).json({
        success: false,
        message: 'Deck not found'
      });
    }

    // Check ownership
    if (deck.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get card details for analysis
    const allCardIds = [...deck.main, ...deck.extra, ...deck.side];
    const cards = await Card.find({ id: { $in: allCardIds } });

    // Calculate detailed statistics
    const stats = {
      composition: {
        monsters: 0,
        spells: 0,
        traps: 0,
        normal: 0,
        effect: 0,
        ritual: 0,
        fusion: 0,
        synchro: 0,
        xyz: 0,
        link: 0
      },
      attributes: {},
      levels: {},
      races: {},
      atkRanges: {},
      defRanges: {},
      archetypes: {},
      averageLevel: 0,
      averageATK: 0,
      averageDEF: 0,
      totalATK: 0,
      totalDEF: 0,
      consistencyScore: 0
    };

    let totalLevel = 0;
    let totalATK = 0;
    let totalDEF = 0;
    let monsterCards = 0;

    cards.forEach(card => {
      // Type composition
      if (card.type) {
        if (card.type.includes('Monster')) {
          stats.composition.monsters++;
          monsterCards++;
          
          if (card.type.includes('Normal')) stats.composition.normal++;
          if (card.type.includes('Effect')) stats.composition.effect++;
          if (card.type.includes('Ritual')) stats.composition.ritual++;
          if (card.type.includes('Fusion')) stats.composition.fusion++;
          if (card.type.includes('Synchro')) stats.composition.synchro++;
          if (card.type.includes('XYZ')) stats.composition.xyz++;
          if (card.type.includes('Link')) stats.composition.link++;
          
          if (card.level) {
            totalLevel += card.level;
            stats.levels[card.level] = (stats.levels[card.level] || 0) + 1;
          }
          
          if (card.atk) {
            totalATK += card.atk;
            stats.totalATK += card.atk;
            
            // ATK ranges
            const atkRange = Math.floor(card.atk / 500) * 500;
            const rangeKey = `${atkRange}-${atkRange + 499}`;
            stats.atkRanges[rangeKey] = (stats.atkRanges[rangeKey] || 0) + 1;
          }
          
          if (card.def) {
            totalDEF += card.def;
            stats.totalDEF += card.def;
            
            // DEF ranges
            const defRange = Math.floor(card.def / 500) * 500;
            const rangeKey = `${defRange}-${defRange + 499}`;
            stats.defRanges[rangeKey] = (stats.defRanges[rangeKey] || 0) + 1;
          }
        } else if (card.type === 'Spell Card') {
          stats.composition.spells++;
        } else if (card.type === 'Trap Card') {
          stats.composition.traps++;
        }
      }

      // Attributes
      if (card.attribute) {
        stats.attributes[card.attribute] = (stats.attributes[card.attribute] || 0) + 1;
      }

      // Races
      if (card.race) {
        stats.races[card.race] = (stats.races[card.race] || 0) + 1;
      }

      // Archetypes
      if (card.archetype) {
        stats.archetypes[card.archetype] = (stats.archetypes[card.archetype] || 0) + 1;
      }
    });

    // Calculate averages
    if (monsterCards > 0) {
      stats.averageLevel = Math.round(totalLevel / monsterCards * 10) / 10;
      stats.averageATK = Math.round(totalATK / monsterCards);
      stats.averageDEF = Math.round(totalDEF / monsterCards);
    }

    // Calculate consistency score
    const cardCounts = {};
    deck.main.forEach(id => {
      cardCounts[id] = (cardCounts[id] || 0) + 1;
    });

    const uniqueCards = Object.keys(cardCounts).length;
    const totalCards = deck.main.length;
    stats.consistencyScore = Math.round((uniqueCards / totalCards) * 100);

    // Get simulation history
    const simulationHistory = deck.simulations
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(sim => ({
        date: sim.date,
        successRate: sim.successRate,
        totalSimulations: sim.totalSimulations,
        targetHands: sim.targetHands,
        averageHandQuality: sim.averageHandQuality
      }));

    // Performance trends
    const performanceTrends = {
      winRate: deck.performance?.winRate || 0,
      totalGames: deck.performance?.totalGames || 0,
      wins: deck.performance?.wins || 0,
      losses: deck.performance?.losses || 0,
      averageTurnCount: deck.performance?.averageTurnCount || 0,
      consistencyScore: deck.performance?.consistencyScore || 0
    };

    res.json({
      success: true,
      analytics: {
        deck: deck.stats,
        calculated: stats,
        performance: performanceTrends,
        simulationHistory,
        cardCounts,
        totalCards: deck.main.length
      }
    });

  } catch (error) {
    console.error('Get deck analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting deck analytics'
    });
  }
});

// @route   POST /api/analytics/simulation
// @desc    Save simulation results
// @access  Private
router.post('/simulation', [
  authenticateToken,
  validateAnalytics,
  body('deckId').isMongoId().withMessage('Valid deck ID is required'),
  body('successRate').isFloat({ min: 0, max: 100 }).withMessage('Success rate must be between 0 and 100'),
  body('totalSimulations').isInt({ min: 1 }).withMessage('Total simulations must be at least 1'),
  body('targetHands').isInt({ min: 1 }).withMessage('Target hands must be at least 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const {
      deckId,
      successRate,
      totalSimulations,
      targetHands,
      averageHandQuality
    } = req.body;

    const deck = await Deck.findById(deckId);
    if (!deck) {
      return res.status(404).json({
        success: false,
        message: 'Deck not found'
      });
    }

    // Check ownership
    if (deck.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Add simulation result
    await deck.addSimulationResult({
      successRate,
      totalSimulations,
      targetHands,
      averageHandQuality
    });

    res.json({
      success: true,
      message: 'Simulation results saved successfully'
    });

  } catch (error) {
    console.error('Save simulation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error saving simulation'
    });
  }
});

// @route   GET /api/analytics/global
// @desc    Get global analytics and statistics
// @access  Public
router.get('/global', async (req, res) => {
  try {
    // Get global deck statistics
    const totalDecks = await Deck.countDocuments();
    const publicDecks = await Deck.countDocuments({ isPublic: true });
    const totalUsers = await User.countDocuments();

    // Get popular archetypes
    const archetypeStats = await Deck.aggregate([
      { $match: { archetype: { $exists: true, $ne: null } } },
      { $group: { _id: '$archetype', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get average deck performance
    const performanceStats = await Deck.aggregate([
      { $match: { 'performance.totalGames': { $gt: 0 } } },
      { $group: {
        _id: null,
        avgWinRate: { $avg: '$performance.winRate' },
        avgGames: { $avg: '$performance.totalGames' },
        totalGames: { $sum: '$performance.totalGames' }
      }}
    ]);

    // Get card usage statistics
    const cardUsageStats = await Card.aggregate([
      { $match: { usageCount: { $gt: 0 } } },
      { $group: {
        _id: null,
        avgUsage: { $avg: '$usageCount' },
        maxUsage: { $max: '$usageCount' },
        totalUsage: { $sum: '$usageCount' }
      }}
    ]);

    // Get recent activity
    const recentDecks = await Deck.find({ isPublic: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('owner', 'username profile.avatar')
      .select('name archetype owner createdAt');

    const globalStats = {
      decks: {
        total: totalDecks,
        public: publicDecks,
        private: totalDecks - publicDecks
      },
      users: totalUsers,
      archetypes: archetypeStats,
      performance: performanceStats[0] || { avgWinRate: 0, avgGames: 0, totalGames: 0 },
      cardUsage: cardUsageStats[0] || { avgUsage: 0, maxUsage: 0, totalUsage: 0 },
      recentActivity: recentDecks
    };

    res.json({
      success: true,
      analytics: globalStats
    });

  } catch (error) {
    console.error('Get global analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting global analytics'
    });
  }
});

// @route   GET /api/analytics/trends
// @desc    Get trending analytics over time
// @access  Public
router.get('/trends', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get deck creation trends
    const deckTrends = await Deck.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Get user registration trends
    const userTrends = await User.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Get popular cards over time
    const popularCards = await Card.find({ usageCount: { $gt: 0 } })
      .sort({ usageCount: -1 })
      .limit(20)
      .select('id name image type archetype usageCount popularity');

    // Get meta analysis
    const metaAnalysis = await Deck.aggregate([
      { $match: { 'performance.totalGames': { $gte: 10 } } },
      { $group: {
        _id: '$archetype',
        avgWinRate: { $avg: '$performance.winRate' },
        totalGames: { $sum: '$performance.totalGames' },
        deckCount: { $sum: 1 }
      }},
      { $match: { totalGames: { $gte: 50 } } },
      { $sort: { avgWinRate: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      trends: {
        period: `${days} days`,
        deckCreation: deckTrends,
        userRegistration: userTrends,
        popularCards,
        metaAnalysis
      }
    });

  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting trends'
    });
  }
});

// @route   GET /api/analytics/compare
// @desc    Compare multiple decks
// @access  Private
router.get('/compare', authenticateToken, async (req, res) => {
  try {
    const { deckIds } = req.query;
    
    if (!deckIds || !Array.isArray(deckIds) || deckIds.length < 2 || deckIds.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Must provide 2-5 deck IDs for comparison'
      });
    }

    const decks = await Deck.find({
      _id: { $in: deckIds },
      $or: [
        { owner: req.user.id },
        { isPublic: true }
      ]
    }).populate('owner', 'username profile.avatar');

    if (decks.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 accessible decks required for comparison'
      });
    }

    // Get card details for all decks
    const allCardIds = decks.flatMap(d => [...d.main, ...d.extra, ...d.side]);
    const cards = await Card.find({ id: { $in: allCardIds } });

    const cardMap = {};
    cards.forEach(card => {
      cardMap[card.id] = card;
    });

    // Analyze each deck
    const comparison = decks.map(deck => {
      const deckCards = deck.main.map(id => cardMap[id]).filter(Boolean);
      
      const stats = {
        id: deck._id,
        name: deck.name,
        owner: deck.owner.username,
        totalCards: deck.main.length,
        monsterCount: deckCards.filter(c => c.type?.includes('Monster')).length,
        spellCount: deckCards.filter(c => c.type === 'Spell Card').length,
        trapCount: deckCards.filter(c => c.type === 'Trap Card').length,
        averageLevel: 0,
        averageATK: 0,
        consistencyScore: 0,
        performance: deck.performance || {},
        archetype: deck.archetype,
        isPublic: deck.isPublic,
        views: deck.views
      };

      const monsterCards = deckCards.filter(c => c.type?.includes('Monster'));
      if (monsterCards.length > 0) {
        const totalLevel = monsterCards.reduce((sum, c) => sum + (c.level || 0), 0);
        const totalATK = monsterCards.reduce((sum, c) => sum + (c.atk || 0), 0);
        
        stats.averageLevel = Math.round(totalLevel / monsterCards.length * 10) / 10;
        stats.averageATK = Math.round(totalATK / monsterCards.length);
      }

      // Calculate consistency score
      const cardCounts = {};
      deck.main.forEach(id => {
        cardCounts[id] = (cardCounts[id] || 0) + 1;
      });
      stats.consistencyScore = Math.round((Object.keys(cardCounts).length / deck.main.length) * 100);

      return stats;
    });

    res.json({
      success: true,
      comparison
    });

  } catch (error) {
    console.error('Compare decks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error comparing decks'
    });
  }
});

export default router;
