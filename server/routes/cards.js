import express from 'express';
import { body, validationResult } from 'express-validator';
import Card from '../models/Card.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateCardSearch } from '../middleware/validation.js';

const router = express.Router();

// @route   GET /api/cards/search
// @desc    Search cards with advanced filtering
// @access  Public
router.get('/search', validateCardSearch, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const {
      q: query,
      page = 1,
      limit = 20,
      type,
      attribute,
      level,
      archetype,
      minATK,
      maxATK,
      minDEF,
      maxDEF,
      race,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Build search query
    let searchQuery = {};

    // Text search
    if (query) {
      searchQuery.$or = [
        { name: { $regex: query, $options: 'i' } },
        { desc: { $regex: query, $options: 'i' } },
        { archetype: { $regex: query, $options: 'i' } }
      ];
    }

    // Type filter
    if (type) {
      searchQuery.type = type;
    }

    // Attribute filter
    if (attribute) {
      searchQuery.attribute = attribute;
    }

    // Level filter
    if (level) {
      searchQuery.level = parseInt(level);
    }

    // Archetype filter
    if (archetype) {
      searchQuery.archetype = { $regex: archetype, $options: 'i' };
    }

    // ATK range filter
    if (minATK || maxATK) {
      searchQuery.atk = {};
      if (minATK) searchQuery.atk.$gte = parseInt(minATK);
      if (maxATK) searchQuery.atk.$lte = parseInt(maxATK);
    }

    // DEF range filter
    if (minDEF || maxDEF) {
      searchQuery.def = {};
      if (minDEF) searchQuery.def.$gte = parseInt(minDEF);
      if (maxDEF) searchQuery.def.$lte = parseInt(maxDEF);
    }

    // Race filter
    if (race) {
      searchQuery.race = { $regex: race, $options: 'i' };
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute search
    const cards = await Card.find(searchQuery)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('id name image attribute level type race atk def archetype aiScore metaTier popularity');

    const total = await Card.countDocuments(searchQuery);

    res.json({
      success: true,
      cards,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalCards: total,
        hasNext: parseInt(page) * parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Card search error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error searching cards'
    });
  }
});

// @route   GET /api/cards/:id
// @desc    Get card by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const card = await Card.findOne({ id: req.params.id });
    
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    // Increment usage count
    await card.incrementUsage();

    res.json({
      success: true,
      card
    });

  } catch (error) {
    console.error('Get card error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting card'
    });
  }
});

// @route   GET /api/cards/popular
// @desc    Get popular cards
// @access  Public
router.get('/popular', async (req, res) => {
  try {
    const { limit = 20, type } = req.query;
    
    const popularCards = await Card.getPopularCards(parseInt(limit), type);

    res.json({
      success: true,
      cards: popularCards
    });

  } catch (error) {
    console.error('Get popular cards error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting popular cards'
    });
  }
});

// @route   GET /api/cards/archetype/:archetype
// @desc    Get cards by archetype
// @access  Public
router.get('/archetype/:archetype', async (req, res) => {
  try {
    const { archetype } = req.params;
    const { limit = 50 } = req.query;
    
    const archetypeCards = await Card.getCardsByArchetype(archetype, parseInt(limit));

    res.json({
      success: true,
      archetype,
      cards: archetypeCards
    });

  } catch (error) {
    console.error('Get archetype cards error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting archetype cards'
    });
  }
});

// @route   GET /api/cards/staple
// @desc    Get staple cards
// @access  Public
router.get('/staple', async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    
    const stapleCards = await Card.getStapleCards(parseInt(limit));

    res.json({
      success: true,
      cards: stapleCards
    });

  } catch (error) {
    console.error('Get staple cards error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting staple cards'
    });
  }
});

// @route   POST /api/cards/bulk
// @desc    Get multiple cards by IDs
// @access  Public
router.post('/bulk', [
  body('ids').isArray({ min: 1, max: 100 }).withMessage('Must provide 1-100 card IDs')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { ids } = req.body;

    const cards = await Card.find({ id: { $in: ids } })
      .select('id name image attribute level type race atk def archetype aiScore metaTier');

    // Create a map for easy lookup
    const cardMap = {};
    cards.forEach(card => {
      cardMap[card.id] = card;
    });

    // Return cards in the order requested
    const orderedCards = ids.map(id => cardMap[id] || { id, name: 'Card not found' });

    res.json({
      success: true,
      cards: orderedCards,
      found: cards.length,
      requested: ids.length
    });

  } catch (error) {
    console.error('Bulk get cards error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting cards'
    });
  }
});

// @route   POST /api/cards/sync
// @desc    Sync card data from YGOPRODeck API
// @access  Private (Admin only)
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { cardIds } = req.body;

    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Must provide array of card IDs'
      });
    }

    const results = {
      synced: 0,
      updated: 0,
      errors: 0,
      details: []
    };

    // Process cards in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < cardIds.length; i += batchSize) {
      const batch = cardIds.slice(i, i + batchSize);
      
      try {
        // Fetch from YGOPRODeck API
        const response = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${batch.join(',')}`);
        const data = await response.json();

        if (data.data) {
          for (const cardData of data.data) {
            try {
              const cardDoc = {
                id: String(cardData.id),
                name: cardData.name,
                image: cardData.card_images?.[0]?.image_url || '',
                attribute: cardData.attribute,
                level: cardData.level,
                type: cardData.type,
                race: cardData.race,
                atk: cardData.atk,
                def: cardData.def,
                desc: cardData.desc,
                archetype: cardData.archetype,
                scale: cardData.scale,
                linkval: cardData.linkval,
                linkmarkers: cardData.linkmarkers,
                card_sets: cardData.card_sets,
                card_prices: cardData.card_prices,
                banlist_info: cardData.banlist_info,
                misc_info: cardData.misc_info
              };

              // Check if card exists
              const existingCard = await Card.findOne({ id: cardDoc.id });
              
              if (existingCard) {
                // Update existing card
                await Card.findByIdAndUpdate(existingCard._id, cardDoc, { new: true });
                results.updated++;
                results.details.push({ id: cardDoc.id, action: 'updated' });
              } else {
                // Create new card
                const newCard = new Card(cardDoc);
                await newCard.save();
                results.synced++;
                results.details.push({ id: cardDoc.id, action: 'created' });
              }
            } catch (cardError) {
              results.errors++;
              results.details.push({ id: cardData.id, action: 'error', error: cardError.message });
            }
          }
        }
      } catch (batchError) {
        results.errors++;
        results.details.push({ batch, action: 'batch_error', error: batchError.message });
      }

      // Small delay between batches
      if (i + batchSize < cardIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    res.json({
      success: true,
      message: 'Card sync completed',
      results
    });

  } catch (error) {
    console.error('Card sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error syncing cards'
    });
  }
});

// @route   PUT /api/cards/:id/rating
// @desc    Update card AI score and meta tier
// @access  Private (Admin/Moderator only)
router.put('/:id/rating', [
  authenticateToken,
  body('aiScore').isFloat({ min: 0, max: 100 }).withMessage('AI score must be between 0 and 100'),
  body('metaTier').isIn(['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3', 'Rogue', 'Unranked']).withMessage('Invalid meta tier')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    // Check if user has permission
    if (!['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const { aiScore, metaTier } = req.body;

    const card = await Card.findOne({ id: req.params.id });
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    card.aiScore = aiScore;
    card.metaTier = metaTier;
    await card.save();

    res.json({
      success: true,
      message: 'Card rating updated successfully',
      card: {
        id: card.id,
        name: card.name,
        aiScore: card.aiScore,
        metaTier: card.metaTier
      }
    });

  } catch (error) {
    console.error('Update card rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating card rating'
    });
  }
});

// @route   POST /api/cards/:id/synergy
// @desc    Add or update card synergy
// @access  Private
router.post('/:id/synergy', [
  authenticateToken,
  body('cardId').notEmpty().withMessage('Target card ID is required'),
  body('strength').isInt({ min: 0, max: 100 }).withMessage('Strength must be between 0 and 100'),
  body('reason').isLength({ min: 1, max: 200 }).withMessage('Reason must be between 1 and 200 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { cardId, strength, reason } = req.body;

    const card = await Card.findOne({ id: req.params.id });
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    // Verify target card exists
    const targetCard = await Card.findOne({ id: cardId });
    if (!targetCard) {
      return res.status(404).json({
        success: false,
        message: 'Target card not found'
      });
    }

    await card.addSynergy(cardId, strength, reason);

    res.json({
      success: true,
      message: 'Synergy added successfully',
      synergy: {
        cardId,
        strength,
        reason
      }
    });

  } catch (error) {
    console.error('Add synergy error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding synergy'
    });
  }
});

// @route   GET /api/cards/filters/attributes
// @desc    Get all available card attributes
// @access  Public
router.get('/filters/attributes', async (req, res) => {
  try {
    const attributes = await Card.distinct('attribute');
    
    res.json({
      success: true,
      attributes: attributes.filter(attr => attr !== null)
    });

  } catch (error) {
    console.error('Get attributes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting attributes'
    });
  }
});

// @route   GET /api/cards/filters/types
// @desc    Get all available card types
// @access  Public
router.get('/filters/types', async (req, res) => {
  try {
    const types = await Card.distinct('type');
    
    res.json({
      success: true,
      types
    });

  } catch (error) {
    console.error('Get types error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting types'
    });
  }
});

// @route   GET /api/cards/filters/races
// @desc    Get all available card races
// @access  Public
router.get('/filters/races', async (req, res) => {
  try {
    const races = await Card.distinct('race');
    
    res.json({
      success: true,
      races: races.filter(race => race !== null)
    });

  } catch (error) {
    console.error('Get races error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting races'
    });
  }
});

// @route   GET /api/cards/filters/archetypes
// @desc    Get all available card archetypes
// @access  Public
router.get('/filters/archetypes', async (req, res) => {
  try {
    const archetypes = await Card.distinct('archetype');
    
    res.json({
      success: true,
      archetypes: archetypes.filter(archetype => archetype !== null)
    });

  } catch (error) {
    console.error('Get archetypes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting archetypes'
    });
  }
});

export default router;
