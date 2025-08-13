import express from 'express';
import { body, validationResult } from 'express-validator';
import Deck from '../models/Deck.js';
import Card from '../models/Card.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateDeck } from '../middleware/validation.js';

const router = express.Router();

// @route   GET /api/decks
// @desc    Get user's decks with pagination and filtering
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      archetype,
      format,
      isPublic,
      sortBy = 'lastUpdated',
      sortOrder = 'desc'
    } = req.query;

    const query = { owner: req.user.id };
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Archetype filter
    if (archetype) {
      query.archetype = { $regex: archetype, $options: 'i' };
    }

    // Format filter
    if (format) {
      query.format = format;
    }

    // Public/private filter
    if (isPublic !== undefined) {
      query.isPublic = isPublic === 'true';
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const decks = await Deck.find(query)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('owner', 'username profile.avatar')
      .select('-main -extra -side'); // Don't send full deck lists

    const total = await Deck.countDocuments(query);

    res.json({
      success: true,
      decks,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalDecks: total,
        hasNext: parseInt(page) * parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Get decks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting decks'
    });
  }
});

// @route   GET /api/decks/public
// @desc    Get public decks with pagination and filtering
// @access  Public
router.get('/public', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      archetype,
      format,
      sortBy = 'views',
      sortOrder = 'desc'
    } = req.query;

    const query = { isPublic: true };
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Archetype filter
    if (archetype) {
      query.archetype = { $regex: archetype, $options: 'i' };
    }

    // Format filter
    if (format) {
      query.format = format;
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const decks = await Deck.find(query)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('owner', 'username profile.avatar')
      .select('name description archetype stats performance views tags format createdAt');

    const total = await Deck.countDocuments(query);

    res.json({
      success: true,
      decks,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalDecks: total,
        hasNext: parseInt(page) * parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Get public decks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting public decks'
    });
  }
});

// @route   GET /api/decks/:id
// @desc    Get deck by ID
// @access  Private (owner) or Public (if public deck)
router.get('/:id', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id)
      .populate('owner', 'username profile.avatar')
      .populate('favorites', 'username profile.avatar');

    if (!deck) {
      return res.status(404).json({
        success: false,
        message: 'Deck not found'
      });
    }

    // Check access permissions
    const isOwner = req.user && deck.owner._id.toString() === req.user.id;
    const isPublic = deck.isPublic;

    if (!isOwner && !isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Increment views for public decks
    if (isPublic && !isOwner) {
      deck.views += 1;
      await deck.save();
    }

    // Get card details for the deck
    const allCardIds = [...deck.main, ...deck.extra, ...deck.side];
    const cards = await Card.find({ id: { $in: allCardIds } })
      .select('id name image attribute level type race atk def archetype');

    const cardMap = {};
    cards.forEach(card => {
      cardMap[card.id] = card;
    });

    // Add card details to deck sections
    const deckWithCards = {
      ...deck.toObject(),
      mainCards: deck.main.map(id => cardMap[id] || { id, name: 'Unknown Card' }),
      extraCards: deck.extra.map(id => cardMap[id] || { id, name: 'Unknown Card' }),
      sideCards: deck.side.map(id => cardMap[id] || { id, name: 'Unknown Card' })
    };

    res.json({
      success: true,
      deck: deckWithCards,
      isOwner
    });

  } catch (error) {
    console.error('Get deck error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting deck'
    });
  }
});

// @route   POST /api/decks
// @desc    Create a new deck
// @access  Private
router.post('/', [authenticateToken, validateDeck], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const {
      name,
      description,
      main,
      extra,
      side,
      isPublic,
      tags,
      archetype,
      format
    } = req.body;

    // Validate deck size
    if (main.length < 40 || main.length > 60) {
      return res.status(400).json({
        success: false,
        message: 'Main deck must contain between 40 and 60 cards'
      });
    }

    // Create deck
    const deck = new Deck({
      name,
      description,
      main,
      extra,
      side,
      isPublic: isPublic || false,
      tags: tags || [],
      archetype,
      format: format || 'TCG',
      owner: req.user.id
    });

    await deck.save();

    // Populate owner info
    await deck.populate('owner', 'username profile.avatar');

    res.status(201).json({
      success: true,
      message: 'Deck created successfully',
      deck
    });

  } catch (error) {
    console.error('Create deck error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating deck'
    });
  }
});

// @route   PUT /api/decks/:id
// @desc    Update deck
// @access  Private (owner only)
router.put('/:id', [authenticateToken, validateDeck], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

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

    const {
      name,
      description,
      main,
      extra,
      side,
      isPublic,
      tags,
      archetype,
      format
    } = req.body;

    // Validate deck size
    if (main.length < 40 || main.length > 60) {
      return res.status(400).json({
        success: false,
        message: 'Main deck must contain between 40 and 60 cards'
      });
    }

    // Update deck
    const updatedDeck = await Deck.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        main,
        extra,
        side,
        isPublic,
        tags,
        archetype,
        format,
        lastUpdated: new Date()
      },
      { new: true, runValidators: true }
    ).populate('owner', 'username profile.avatar');

    res.json({
      success: true,
      message: 'Deck updated successfully',
      deck: updatedDeck
    });

  } catch (error) {
    console.error('Update deck error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating deck'
    });
  }
});

// @route   DELETE /api/decks/:id
// @desc    Delete deck
// @access  Private (owner only)
router.delete('/:id', authenticateToken, async (req, res) => {
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

    await Deck.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Deck deleted successfully'
    });

  } catch (error) {
    console.error('Delete deck error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting deck'
    });
  }
});

// @route   POST /api/decks/:id/favorite
// @desc    Toggle favorite status
// @access  Private
router.post('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);
    if (!deck) {
      return res.status(404).json({
        success: false,
        message: 'Deck not found'
      });
    }

    const userId = req.user.id;
    const isFavorited = deck.favorites.includes(userId);

    if (isFavorited) {
      // Remove from favorites
      deck.favorites = deck.favorites.filter(id => id.toString() !== userId);
    } else {
      // Add to favorites
      deck.favorites.push(userId);
    }

    await deck.save();

    res.json({
      success: true,
      message: isFavorited ? 'Removed from favorites' : 'Added to favorites',
      isFavorited: !isFavorited
    });

  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error toggling favorite'
    });
  }
});

// @route   POST /api/decks/:id/share
// @desc    Toggle deck visibility (public/private)
// @access  Private (owner only)
router.post('/:id/share', authenticateToken, async (req, res) => {
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

    deck.isPublic = !deck.isPublic;
    await deck.save();

    res.json({
      success: true,
      message: deck.isPublic ? 'Deck is now public' : 'Deck is now private',
      isPublic: deck.isPublic
    });

  } catch (error) {
    console.error('Toggle share error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error toggling share'
    });
  }
});

// @route   POST /api/decks/:id/duplicate
// @desc    Duplicate a deck
// @access  Private
router.post('/:id/duplicate', authenticateToken, async (req, res) => {
  try {
    const originalDeck = await Deck.findById(req.params.id);
    if (!originalDeck) {
      return res.status(404).json({
        success: false,
        message: 'Deck not found'
      });
    }

    // Check if user can access the deck
    const isOwner = originalDeck.owner.toString() === req.user.id;
    const isPublic = originalDeck.isPublic;

    if (!isOwner && !isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Create duplicate
    const duplicatedDeck = new Deck({
      name: `${originalDeck.name} (Copy)`,
      description: originalDeck.description,
      main: originalDeck.main,
      extra: originalDeck.extra,
      side: originalDeck.side,
      isPublic: false, // Always private by default
      tags: originalDeck.tags,
      archetype: originalDeck.archetype,
      format: originalDeck.format,
      owner: req.user.id
    });

    await duplicatedDeck.save();
    await duplicatedDeck.populate('owner', 'username profile.avatar');

    res.status(201).json({
      success: true,
      message: 'Deck duplicated successfully',
      deck: duplicatedDeck
    });

  } catch (error) {
    console.error('Duplicate deck error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error duplicating deck'
    });
  }
});

// @route   GET /api/decks/:id/analytics
// @desc    Get deck analytics and statistics
// @access  Private (owner) or Public (if public deck)
router.get('/:id/analytics', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);
    if (!deck) {
      return res.status(404).json({
        success: false,
        message: 'Deck not found'
      });
    }

    // Check access permissions
    const isOwner = req.user && deck.owner.toString() === req.user.id;
    const isPublic = deck.isPublic;

    if (!isOwner && !isPublic) {
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
      totalCards: deck.main.length,
      mainDeck: deck.main.length,
      extraDeck: deck.extra.length,
      sideDeck: deck.side.length,
      monsterCount: 0,
      spellCount: 0,
      trapCount: 0,
      attributeBreakdown: {},
      levelBreakdown: {},
      typeBreakdown: {},
      raceBreakdown: {},
      averageLevel: 0,
      averageATK: 0,
      averageDEF: 0,
      totalATK: 0,
      totalDEF: 0
    };

    let totalLevel = 0;
    let totalATK = 0;
    let totalDEF = 0;
    let monsterCards = 0;

    cards.forEach(card => {
      if (card.type && card.type.includes('Monster')) {
        stats.monsterCount++;
        monsterCards++;
        
        if (card.level) {
          totalLevel += card.level;
          stats.levelBreakdown[card.level] = (stats.levelBreakdown[card.level] || 0) + 1;
        }
        
        if (card.atk) {
          totalATK += card.atk;
          stats.totalATK += card.atk;
        }
        
        if (card.def) {
          totalDEF += card.def;
          stats.totalDEF += card.def;
        }
      } else if (card.type === 'Spell Card') {
        stats.spellCount++;
      } else if (card.type === 'Trap Card') {
        stats.trapCount++;
      }

      if (card.attribute) {
        stats.attributeBreakdown[card.attribute] = (stats.attributeBreakdown[card.attribute] || 0) + 1;
      }

      if (card.type) {
        stats.typeBreakdown[card.type] = (stats.typeBreakdown[card.type] || 0) + 1;
      }

      if (card.race) {
        stats.raceBreakdown[card.race] = (stats.raceBreakdown[card.race] || 0) + 1;
      }
    });

    // Calculate averages
    if (monsterCards > 0) {
      stats.averageLevel = Math.round(totalLevel / monsterCards * 10) / 10;
      stats.averageATK = Math.round(totalATK / monsterCards);
      stats.averageDEF = Math.round(totalDEF / monsterCards);
    }

    res.json({
      success: true,
      analytics: {
        deck: deck.stats,
        calculated: stats,
        performance: deck.performance,
        simulations: deck.simulations
      }
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting analytics'
    });
  }
});

// @route   GET /api/decks/popular
// @desc    Get popular decks
// @access  Public
router.get('/popular', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const popularDecks = await Deck.getPopularDecks(parseInt(limit));

    res.json({
      success: true,
      decks: popularDecks
    });

  } catch (error) {
    console.error('Get popular decks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting popular decks'
    });
  }
});

// @route   GET /api/decks/archetype/:archetype
// @desc    Get decks by archetype
// @access  Public
router.get('/archetype/:archetype', async (req, res) => {
  try {
    const { archetype } = req.params;
    const { limit = 20 } = req.query;
    
    const archetypeDecks = await Deck.getDecksByArchetype(archetype, parseInt(limit));

    res.json({
      success: true,
      archetype,
      decks: archetypeDecks
    });

  } catch (error) {
    console.error('Get archetype decks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting archetype decks'
    });
  }
});

export default router;
