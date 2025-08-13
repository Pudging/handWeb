import mongoose from 'mongoose';

const deckSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  main: [{
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return v.length > 0 && v.length <= 20;
      },
      message: 'Card ID must be between 1 and 20 characters'
    }
  }],
  extra: [{
    type: String,
    validate: {
      validator: function(v) {
        return v.length > 0 && v.length <= 20;
      },
      message: 'Card ID must be between 1 and 20 characters'
    }
  }],
  side: [{
    type: String,
    validate: {
      validator: function(v) {
        return v.length > 0 && v.length <= 20;
      },
      message: 'Card ID must be between 1 and 20 characters'
    }
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 30
  }],
  archetype: {
    type: String,
    trim: true,
    maxlength: 50
  },
  format: {
    type: String,
    enum: ['TCG', 'OCG', 'Traditional', 'Unlimited'],
    default: 'TCG'
  },
  stats: {
    totalCards: {
      type: Number,
      default: 0
    },
    monsterCount: {
      type: Number,
      default: 0
    },
    spellCount: {
      type: Number,
      default: 0
    },
    trapCount: {
      type: Number,
      default: 0
    },
    averageLevel: {
      type: Number,
      default: 0
    },
    averageATK: {
      type: Number,
      default: 0
    }
  },
  performance: {
    winRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    totalGames: {
      type: Number,
      default: 0
    },
    wins: {
      type: Number,
      default: 0
    },
    losses: {
      type: Number,
      default: 0
    },
    averageTurnCount: {
      type: Number,
      default: 0
    },
    consistencyScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  simulations: [{
    date: {
      type: Date,
      default: Date.now
    },
    successRate: {
      type: Number,
      min: 0,
      max: 100
    },
    totalSimulations: Number,
    targetHands: Number,
    averageHandQuality: Number
  }],
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  views: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for checking if deck is valid
deckSchema.virtual('isValid').get(function() {
  return this.main.length >= 40 && this.main.length <= 60;
});

// Virtual for deck type classification
deckSchema.virtual('deckType').get(function() {
  const monsterRatio = this.stats.monsterCount / this.stats.totalCards;
  if (monsterRatio > 0.6) return 'Monster-Heavy';
  if (monsterRatio < 0.4) return 'Spell/Trap-Heavy';
  return 'Balanced';
});

// Indexes for performance
deckSchema.index({ owner: 1, createdAt: -1 });
deckSchema.index({ isPublic: 1, createdAt: -1 });
deckSchema.index({ archetype: 1 });
deckSchema.index({ tags: 1 });
deckSchema.index({ 'performance.winRate': -1 });
deckSchema.index({ views: -1 });

// Pre-save middleware to update stats
deckSchema.pre('save', function(next) {
  this.stats.totalCards = this.main.length;
  this.lastUpdated = new Date();
  
  // Update card type counts (this will be populated from card data)
  this.stats.monsterCount = 0;
  this.stats.spellCount = 0;
  this.stats.trapCount = 0;
  
  next();
});

// Static method to get popular decks
deckSchema.statics.getPopularDecks = function(limit = 10) {
  return this.find({ isPublic: true })
    .sort({ views: -1, 'performance.winRate': -1 })
    .limit(limit)
    .populate('owner', 'username profile.avatar')
    .select('name description archetype stats performance views');
};

// Static method to get decks by archetype
deckSchema.statics.getDecksByArchetype = function(archetype, limit = 20) {
  return this.find({ 
    archetype: new RegExp(archetype, 'i'),
    isPublic: true 
  })
    .sort({ 'performance.winRate': -1, views: -1 })
    .limit(limit)
    .populate('owner', 'username profile.avatar')
    .select('name description stats performance views');
};

// Instance method to update performance stats
deckSchema.methods.updatePerformance = function(gameResult) {
  this.performance.totalGames += 1;
  
  if (gameResult === 'win') {
    this.performance.wins += 1;
  } else if (gameResult === 'loss') {
    this.performance.losses += 1;
  }
  
  this.performance.winRate = (this.performance.wins / this.performance.totalGames) * 100;
  return this.save();
};

// Instance method to add simulation result
deckSchema.methods.addSimulationResult = function(result) {
  this.simulations.push(result);
  
  // Keep only last 100 simulations
  if (this.simulations.length > 100) {
    this.simulations = this.simulations.slice(-100);
  }
  
  return this.save();
};

export default mongoose.model('Deck', deckSchema);
