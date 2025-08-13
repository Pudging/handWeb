import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { decks } from '../utils/api';

interface Deck {
  _id: string;
  name: string;
  description: string;
  main: string[];
  extra: string[];
  side: string[];
  isPublic: boolean;
  tags: string[];
  archetype: string;
  format: string;
  stats: {
    totalCards: number;
    monsters: number;
    spells: number;
    traps: number;
  };
  performance: {
    winRate: number;
    games: number;
    wins: number;
    losses: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface DeckManagerProps {
  currentDeck: any;
  onDeckLoad: (deck: any) => void;
  onClose: () => void;
}

const DeckManager: React.FC<DeckManagerProps> = ({ currentDeck, onDeckLoad, onClose }) => {
  const { user, isAuthenticated } = useAuth();
  const [userDecks, setUserDecks] = useState<Deck[]>([]);
  const [publicDecks, setPublicDecks] = useState<Deck[]>([]);
  const [activeTab, setActiveTab] = useState<'my-decks' | 'public-decks' | 'save-deck'>('my-decks');
  const [isLoading, setIsLoading] = useState(false);
  const [saveForm, setSaveForm] = useState({
    name: '',
    description: '',
    isPublic: false,
    tags: '',
    archetype: '',
    format: 'TCG'
  });

  useEffect(() => {
    if (isAuthenticated) {
      loadUserDecks();
    }
    loadPublicDecks();
  }, [isAuthenticated]);

  const loadUserDecks = async () => {
    try {
      setIsLoading(true);
      const response = await decks.getAll();
      if (response.success) {
        setUserDecks(response.data || []);
      }
    } catch (error) {
      console.error('Error loading user decks:', error);
      toast.error('Failed to load your decks');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPublicDecks = async () => {
    try {
      const response = await decks.getPublic();
      if (response.success) {
        setPublicDecks(response.data || []);
      }
    } catch (error) {
      console.error('Error loading public decks:', error);
    }
  };

  const handleSaveDeck = async () => {
    if (!saveForm.name.trim()) {
      toast.error('Please enter a deck name');
      return;
    }

    try {
      setIsLoading(true);
      const deckData = {
        name: saveForm.name.trim(),
        description: saveForm.description.trim(),
        main: currentDeck.main,
        extra: currentDeck.extra,
        side: currentDeck.side,
        isPublic: saveForm.isPublic,
        tags: saveForm.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        archetype: saveForm.archetype.trim(),
        format: saveForm.format
      };

      const response = await decks.create(deckData);
      if (response.success) {
        toast.success('Deck saved successfully!');
        setSaveForm({
          name: '',
          description: '',
          isPublic: false,
          tags: '',
          archetype: '',
          format: 'TCG'
        });
        loadUserDecks();
        setActiveTab('my-decks');
      } else {
        toast.error(response.message || 'Failed to save deck');
      }
    } catch (error) {
      console.error('Error saving deck:', error);
      toast.error('Failed to save deck');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDeck = (deck: Deck) => {
    onDeckLoad({
      main: deck.main,
      extra: deck.extra,
      side: deck.side
    });
    toast.success(`Loaded deck: ${deck.name}`);
    onClose();
  };

  const handleDeleteDeck = async (deckId: string) => {
    if (!confirm('Are you sure you want to delete this deck?')) return;

    try {
      const response = await decks.delete(deckId);
      if (response.success) {
        toast.success('Deck deleted successfully');
        loadUserDecks();
      } else {
        toast.error(response.message || 'Failed to delete deck');
      }
    } catch (error) {
      console.error('Error deleting deck:', error);
      toast.error('Failed to delete deck');
    }
  };

  const handleDuplicateDeck = async (deck: Deck) => {
    try {
      const response = await decks.duplicate(deck._id);
      if (response.success) {
        toast.success('Deck duplicated successfully!');
        loadUserDecks();
      } else {
        toast.error(response.message || 'Failed to duplicate deck');
      }
    } catch (error) {
      console.error('Error duplicating deck:', error);
      toast.error('Failed to duplicate deck');
    }
  };

  const renderDeckCard = (deck: Deck, isOwned: boolean = false) => (
    <motion.div
      key={deck._id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'rgba(30,30,40,0.9)',
        borderRadius: 12,
        padding: 16,
        border: '1px solid #3a3a7a',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h4 style={{ color: '#fff', margin: '0 0 4px 0', fontSize: 16, fontWeight: 600 }}>
            {deck.name}
          </h4>
          {deck.description && (
            <p style={{ color: '#ccc', margin: 0, fontSize: 12, lineHeight: 1.4 }}>
              {deck.description}
            </p>
          )}
        </div>
        {isOwned && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDuplicateDeck(deck);
              }}
              style={{
                background: '#234a7a',
                border: 'none',
                borderRadius: 4,
                color: '#fff',
                fontSize: 10,
                padding: '4px 8px',
                cursor: 'pointer'
              }}
              title="Duplicate"
            >
              📋
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteDeck(deck._id);
              }}
              style={{
                background: '#7a2a2a',
                border: 'none',
                borderRadius: 4,
                color: '#fff',
                fontSize: 10,
                padding: '4px 8px',
                cursor: 'pointer'
              }}
              title="Delete"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#2a7a3a', fontSize: 18, fontWeight: 700 }}>
            {deck.stats.totalCards}
          </div>
          <div style={{ color: '#888', fontSize: 10 }}>Cards</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#ff6b6b', fontSize: 18, fontWeight: 700 }}>
            {deck.stats.monsters}
          </div>
          <div style={{ color: '#888', fontSize: 10 }}>Monsters</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        {deck.tags.slice(0, 3).map((tag, index) => (
          <span
            key={index}
            style={{
              background: 'rgba(60,60,80,0.6)',
              color: '#fff',
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 10,
              border: '1px solid #3a3a7a'
            }}
          >
            {tag}
          </span>
        ))}
        {deck.tags.length > 3 && (
          <span style={{ color: '#888', fontSize: 10 }}>+{deck.tags.length - 3} more</span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#888' }}>
          {deck.archetype && <span>🏷️ {deck.archetype}</span>}
          {deck.format && <span style={{ marginLeft: 8 }}>📋 {deck.format}</span>}
        </div>
        <div style={{ fontSize: 11, color: '#888' }}>
          {new Date(deck.updatedAt).toLocaleDateString()}
        </div>
      </div>

      {deck.performance.games > 0 && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(40,40,60,0.5)', borderRadius: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#ccc' }}>Win Rate:</span>
            <span style={{ color: '#2a7a3a', fontWeight: 600 }}>
              {((deck.performance.wins / deck.performance.games) * 100).toFixed(1)}%
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#ccc' }}>Games:</span>
            <span style={{ color: '#fff' }}>{deck.performance.games}</span>
          </div>
        </div>
      )}
    </motion.div>
  );

  if (!isAuthenticated) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          background: 'rgba(40, 44, 52, 0.98)',
          borderRadius: 16,
          padding: 32,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          maxWidth: 500,
          margin: '0 auto',
          textAlign: 'center'
        }}
      >
        <h3 style={{ color: '#fff', marginBottom: 16, fontSize: 20 }}>🔐 Authentication Required</h3>
        <p style={{ color: '#ccc', marginBottom: 24, lineHeight: 1.5 }}>
          You need to be logged in to manage decks. Please log in or create an account to save and load your decks.
        </p>
        <button
          onClick={onClose}
          style={{
            padding: '12px 24px',
            background: '#234a7a',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        background: 'rgba(40, 44, 52, 0.98)',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        maxWidth: 1000,
        margin: '0 auto',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ color: '#fff', margin: 0, fontSize: 24, fontWeight: 700 }}>
          🎴 Deck Manager
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: 24,
            cursor: 'pointer',
            padding: 4
          }}
        >
          ×
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('my-decks')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'my-decks' ? '#2a7a3a' : 'rgba(60,60,80,0.8)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          📁 My Decks ({userDecks.length})
        </button>
        <button
          onClick={() => setActiveTab('public-decks')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'public-decks' ? '#2a7a3a' : 'rgba(60,60,80,0.8)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🌐 Public Decks ({publicDecks.length})
        </button>
        <button
          onClick={() => setActiveTab('save-deck')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'save-deck' ? '#2a7a3a' : 'rgba(60,60,80,0.8)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          💾 Save Current Deck
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* My Decks Tab */}
        {activeTab === 'my-decks' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ color: '#888', fontSize: 16 }}>Loading your decks...</div>
              </div>
            ) : userDecks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ color: '#888', fontSize: 16, marginBottom: 16 }}>
                  You haven't saved any decks yet.
                </div>
                <button
                  onClick={() => setActiveTab('save-deck')}
                  style={{
                    padding: '10px 20px',
                    background: '#2a7a3a',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                >
                  Save Your First Deck
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {userDecks.map(deck => (
                  <div key={deck._id} onClick={() => handleLoadDeck(deck)}>
                    {renderDeckCard(deck, true)}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Public Decks Tab */}
        {activeTab === 'public-decks' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {publicDecks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ color: '#888', fontSize: 16 }}>No public decks available.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {publicDecks.map(deck => (
                  <div key={deck._id} onClick={() => handleLoadDeck(deck)}>
                    {renderDeckCard(deck, false)}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Save Deck Tab */}
        {activeTab === 'save-deck' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ maxWidth: 500, margin: '0 auto' }}
          >
            <h3 style={{ color: '#fff', marginBottom: 20, fontSize: 18 }}>Save Current Deck</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ color: '#ccc', fontSize: 14, marginBottom: 6, display: 'block' }}>
                  Deck Name *
                </label>
                <input
                  type="text"
                  value={saveForm.name}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(40,40,60,0.8)',
                    border: '1px solid #3a3a7a',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none'
                  }}
                  placeholder="Enter deck name"
                />
              </div>

              <div>
                <label style={{ color: '#ccc', fontSize: 14, marginBottom: 6, display: 'block' }}>
                  Description
                </label>
                <textarea
                  value={saveForm.description}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(40,40,60,0.8)',
                    border: '1px solid #3a3a7a',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                    resize: 'vertical',
                    minHeight: 80
                  }}
                  placeholder="Describe your deck strategy..."
                />
              </div>

              <div>
                <label style={{ color: '#ccc', fontSize: 14, marginBottom: 6, display: 'block' }}>
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={saveForm.tags}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, tags: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(40,40,60,0.8)',
                    border: '1px solid #3a3a7a',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none'
                  }}
                  placeholder="e.g., competitive, control, budget"
                />
              </div>

              <div>
                <label style={{ color: '#ccc', fontSize: 14, marginBottom: 6, display: 'block' }}>
                  Archetype
                </label>
                <input
                  type="text"
                  value={saveForm.archetype}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, archetype: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(40,40,60,0.8)',
                    border: '1px solid #3a3a7a',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none'
                  }}
                  placeholder="e.g., Blue-Eyes, Dark Magician"
                />
              </div>

              <div>
                <label style={{ color: '#ccc', fontSize: 14, marginBottom: 6, display: 'block' }}>
                  Format
                </label>
                <select
                  value={saveForm.format}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, format: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(40,40,60,0.8)',
                    border: '1px solid #3a3a7a',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none'
                  }}
                >
                  <option value="TCG">TCG</option>
                  <option value="OCG">OCG</option>
                  <option value="Traditional">Traditional</option>
                  <option value="Unlimited">Unlimited</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={saveForm.isPublic}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, isPublic: e.target.checked }))}
                  style={{ margin: 0 }}
                />
                <label htmlFor="isPublic" style={{ color: '#ccc', fontSize: 14, cursor: 'pointer' }}>
                  Make this deck public (visible to other users)
                </label>
              </div>

              <button
                onClick={handleSaveDeck}
                disabled={isLoading || !saveForm.name.trim()}
                style={{
                  padding: '14px 24px',
                  background: saveForm.name.trim() && !isLoading ? '#2a7a3a' : '#555',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: saveForm.name.trim() && !isLoading ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s'
                }}
              >
                {isLoading ? 'Saving...' : 'Save Deck'}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default DeckManager;
