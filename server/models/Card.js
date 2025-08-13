import mongoose from 'mongoose';

const cardSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  image: {
    type: String,
    trim: true
  },
  attribute: {
    type: String,
    enum: ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND', 'DIVINE', null],
    index: true
  },
  level: {
    type: Number,
    min: 0,
    max: 12,
    index: true
  },
  type: {
    type: String,
    required: true,
    index: true
  },
  race: {
    type: String,
    trim: true,
    index: true
  },
  atk: {
    type: Number,
    index: true
  },
  def: {
    type: Number,
    index: true
  },
  desc: {
    type: String,
    trim: true
  },
  archetype: {
    type: String,
    trim: true,
    index: true
  },
  scale: {
    type: Number,
    min: 0,
    max: 13
  },
  linkval: {
    type: Number,
    min: 0,
    max: 8
  },
  linkmarkers: [{
    type: String,
    enum: ['Top', 'Top-Left', 'Top-Right', 'Left', 'Right', 'Bottom-Left', 'Bottom', 'Bottom-Right']
  }],
  card_sets: [{
    set_name: String,
    set_code: String,
    set_rarity: String,
    set_rarity_code: String,
    set_price: String
  }],
  card_prices: [{
    cardmarket_price: String,
    tcgplayer_price: String,
    ebay_price: String,
    amazon_price: String,
    coolstuffinc_price: String
  }],
  banlist_info: {
    ban_tcg: String,
    ban_ocg: String,
    ban_goat: String
  },
  misc_info: [{
    beta_name: String,
    treated_as: String,
    datelist: String,
    has_effect: Boolean
  }],
  // Custom fields for our application
  popularity: {
    type: Number,
    default: 0,
    index: true
  },
  usageCount: {
    type: Number,
    default: 0,
    index: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  // AI/ML features
  aiScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  metaTier: {
    type: String,
    enum: ['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3', 'Rogue', 'Unranked'],
    default: 'Unranked',
    index: true
  },
  // Card relationships
  synergies: [{
    cardId: String,
    strength: {
      type: Number,
      min: 0,
      max: 100
    },
    reason: String
  }],
  counters: [{
    cardId: String,
    effectiveness: {
      type: Number,
      min: 0,
      max: 100
    },
    reason: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for card type classification
cardSchema.virtual('isMonster').get(function() {
  return this.type && this.type.includes('Monster');
});

cardSchema.virtual('isSpell').get(function() {
  return this.type === 'Spell Card';
});

cardSchema.virtual('isTrap').get(function() {
  return this.type === 'Trap Card';
});

cardSchema.virtual('isExtraDeck').get(function() {
  return this.type && (
    this.type.includes('Fusion') ||
    this.type.includes('Synchro') ||
    this.type.includes('XYZ') ||
    this.type.includes('Link')
  );
});

// Virtual for power level calculation
cardSchema.virtual('powerLevel').get(function() {
  if (!this.isMonster) return 0;
  
  let power = 0;
  if (this.atk) power += this.atk;
  if (this.def) power += this.def;
  if (this.level) power += this.level * 100;
  
  return power;
});

// Indexes for performance
cardSchema.index({ name: 'text', desc: 'text' }); // Text search
cardSchema.index({ archetype: 1, type: 1 });
cardSchema.index({ attribute: 1, level: 1 });
cardSchema.index({ atk: 1, def: 1 });
cardSchema.index({ popularity: -1, usageCount: -1 });
cardSchema.index({ metaTier: 1, aiScore: -1 });

// Static method to search cards
cardSchema.statics.searchCards = function(query, options = {}) {
  const {
    limit = 20,
    page = 1,
    type,
    attribute,
    level,
    archetype,
    minATK,
    maxATK,
    sortBy = 'name',
    sortOrder = 'asc'
  } = options;

  let searchQuery = {};

  // Text search
  if (query) {
    searchQuery.$text = { $search: query };
  }

  // Filters
  if (type) searchQuery.type = type;
  if (attribute) searchQuery.attribute = attribute;
  if (level) searchQuery.level = level;
  if (archetype) searchQuery.archetype = new RegExp(archetype, 'i');
  if (minATK || maxATK) {
    searchQuery.atk = {};
    if (minATK) searchQuery.atk.$gte = minATK;
    if (maxATK) searchQuery.atk.$lte = maxATK;
  }

  // Sorting
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  return this.find(searchQuery)
    .sort(sortOptions)
    .limit(limit)
    .skip((page - 1) * limit)
    .select('id name image attribute level type race atk def archetype aiScore metaTier');
};

// Static method to get popular cards
cardSchema.statics.getPopularCards = function(limit = 20, type = null) {
  let query = {};
  if (type) query.type = type;

  return this.find(query)
    .sort({ popularity: -1, usageCount: -1 })
    .limit(limit)
    .select('id name image type archetype popularity usageCount');
};

// Static method to get cards by archetype
cardSchema.statics.getCardsByArchetype = function(archetype, limit = 50) {
  return this.find({ archetype: new RegExp(archetype, 'i') })
    .sort({ aiScore: -1, popularity: -1 })
    .limit(limit)
    .select('id name image type attribute level atk def archetype aiScore');
};

// Static method to get staple cards
cardSchema.statics.getStapleCards = function(limit = 30) {
  return this.find({ 
    $or: [
      { metaTier: { $in: ['Tier 0', 'Tier 1'] } },
      { aiScore: { $gte: 80 } },
      { popularity: { $gte: 1000 } }
    ]
  })
    .sort({ aiScore: -1, popularity: -1 })
    .limit(limit)
    .select('id name image type archetype aiScore metaTier');
};

// Instance method to update usage count
cardSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUpdated = new Date();
  return this.save();
};

// Instance method to update popularity
cardSchema.methods.updatePopularity = function(newPopularity) {
  this.popularity = newPopularity;
  this.lastUpdated = new Date();
  return this.save();
};

// Instance method to add synergy
cardSchema.methods.addSynergy = function(cardId, strength, reason) {
  const existingIndex = this.synergies.findIndex(s => s.cardId === cardId);
  
  if (existingIndex >= 0) {
    this.synergies[existingIndex] = { cardId, strength, reason };
  } else {
    this.synergies.push({ cardId, strength, reason });
  }
  
  return this.save();
};

export default mongoose.model('Card', cardSchema);
