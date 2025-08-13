import React, { useState, useEffect, useRef, useMemo } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import './App.css'
import UploadYDK from './UploadYDK'
import type { DeckSections } from './UploadYDK'
import CardSearch from './CardSearch'
import type { CardSearchResult } from './CardSearch'
import { useState as useSimState } from 'react';
import Auth from './components/Auth'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AIChatbot from './components/AIChatbot'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import DeckManager from './components/DeckManager'

// YGOPRODeck API endpoint for card info by ID
const YGOPRO_API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?id=';

type CardData = {
  id: string;
  name: string;
  image: string;
  attribute?: string;
  level?: number;
  type?: string;
  race?: string;
  atk?: number;
  def?: number;
  desc?: string;
  archetype?: string;
};

type FilterCard = {
  id: string;
  name: string;
  filterByAttribute?: string;
  filterByType?: string;
  filterByRace?: string;
  filterByLevel?: { min?: number; max?: number };
  filterByATK?: { min?: number; max?: number };
  filterByArchetype?: string;
};

type HandCardCondition = {
  group: (FilterCard | { id: string; name: string })[];
  op: '=' | '<=' | '>=' | '!=';
  count: number;
  unique?: boolean;
};

function handMatches(hand: string[], conditions: HandCardCondition[], cardCache: Record<string, CardData>) {
  const counts: Record<string, number> = {};
  for (const id of hand) counts[id] = (counts[id] || 0) + 1;
  
  // Create a copy of counts that we can modify as we assign cards to groups
  const remainingCounts = { ...counts };
  
  for (const cond of conditions) {
    let groupCount = 0;
    const cardsNeeded = cond.count;
    
    // Check each card in the group (can be regular cards or filter cards)
    for (const groupItem of cond.group) {
      if ('filterByAttribute' in groupItem) {
        // This is a filter card - count cards in hand that match the filter
        const filteredHand = hand.filter(id => {
          const card = cardCache[id];
          if (!card) return false;
          
          // Check attribute filter
          if (groupItem.filterByAttribute && card.attribute !== groupItem.filterByAttribute) return false;
          
          // Check type filter
          if (groupItem.filterByType && card.type !== groupItem.filterByType) return false;
          
          // Check race filter
          if (groupItem.filterByRace && card.race !== groupItem.filterByRace) return false;
          
          // Check level filter
          if (groupItem.filterByLevel) {
            if (groupItem.filterByLevel.min !== undefined && (card.level || 0) < groupItem.filterByLevel.min) return false;
            if (groupItem.filterByLevel.max !== undefined && (card.level || 0) > groupItem.filterByLevel.max) return false;
          }
          
          // Check ATK filter
          if (groupItem.filterByATK) {
            if (groupItem.filterByATK.min !== undefined && (card.atk || 0) < groupItem.filterByATK.min) return false;
            if (groupItem.filterByATK.max !== undefined && (card.atk || 0) > groupItem.filterByATK.max) return false;
          }
          
          // Check archetype filter
          if (groupItem.filterByArchetype && card.archetype !== groupItem.filterByArchetype) return false;
          
          return true;
        });
        
        // Count how many cards match this filter
        const filterCount = filteredHand.length;
        groupCount += filterCount;
        
        // Mark used cards as consumed
        for (const id of filteredHand) {
          if (remainingCounts[id] > 0) {
            remainingCounts[id]--;
          }
        }
      } else {
        // This is a regular card - count it if available
        if ((remainingCounts[groupItem.id] || 0) > 0) {
          groupCount++;
          remainingCounts[groupItem.id]--;
        }
      }
    }
    
    // Check if condition is satisfied
    if (cond.op === '=' && groupCount !== cond.count) return false;
    if (cond.op === '<=' && groupCount > cond.count) return false;
    if (cond.op === '>=' && groupCount < cond.count) return false;
    if (cond.op === '!=' && groupCount !== 0) return false;
  }
  return true;
}

function HandSimulation({ deck }: { deck: DeckSections }) {
  const [numSim, setNumSim] = useSimState(1000);
  const [handSize, setHandSize] = useSimState(5);
  const [targetHands, setTargetHands] = useSimState<HandCardCondition[][]>([[]]);
  const [results, setResults] = useSimState<number[]>([]);
  const [running, setRunning] = useSimState(false);
  const [error, setError] = useSimState('');
  const [testHandCards, setTestHandCards] = useSimState<{id: string, name: string, image?: string}[]>([]);
  const [testHandKey, setTestHandKey] = useSimState(0);
  const navigate = useNavigate();

  // Card info for search/autocomplete
  const cardCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of deck.main) counts[id] = (counts[id] || 0) + 1;
    return counts;
  }, [deck.main]);
  // Use card names from deck (by majority occurrence in main deck)
  const cardNameMap = useMemo(() => {
    // Try to get names from the main deck display (deck builder)
    // If not available, fallback to ID
    const nameMap: Record<string, string> = {};
    // Try to get from localStorage cardCache if available
    try {
      const cache = JSON.parse(localStorage.getItem('cardCache') || '{}');
      for (const id in cache) nameMap[id] = cache[id].name;
    } catch {}
    // Fallback: use ID as name
    for (const id of Object.keys(cardCounts)) {
      if (!nameMap[id]) nameMap[id] = id;
    }
    return nameMap;
  }, [cardCounts]);
  const cardList = useMemo(() => {
    return Object.keys(cardCounts).map(id => ({ id, name: cardNameMap[id] }));
  }, [cardCounts, cardNameMap]);

  // Hand pattern builder state: each hand is an array of OR groups (HandCardCondition)
  const [inputTargets, setInputTargets] = useSimState<HandCardCondition[][]>(() => {
    try {
      const saved = localStorage.getItem('inputTargets');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [[]];
  });
  const [groupSearchInputs, setGroupSearchInputs] = useSimState<string[][]>(() => {
    try {
      const saved = localStorage.getItem('inputTargets');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.map((hand: any) => hand.map(() => '')) : [[]];
      }
    } catch {}
    return [[]];
  });
  const [savedPatterns, setSavedPatterns] = useSimState<HandCardCondition[][][]>([]);
  const [exclusiveMode, setExclusiveMode] = useSimState(false);
  const [selectedFilterCard, setSelectedFilterCard] = useSimState<{
    handIdx: number;
    groupIdx: number;
    cardIdx: number;
    card: FilterCard;
  } | null>(null);

  // Save inputTargets to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('inputTargets', JSON.stringify(inputTargets));
    } catch {}
  }, [inputTargets]);

  // Also reset groupSearchInputs if inputTargets length/structure changes (e.g. after reload)
  useEffect(() => {
    setGroupSearchInputs(inputs => {
      if (
        inputs.length !== inputTargets.length ||
        inputs.some((g, i) => g.length !== inputTargets[i].length)
      ) {
        return inputTargets.map(hand => hand.map(() => ''));
      }
      return inputs;
    });
  }, [inputTargets]);

  // Add a new OR group to a target hand
  const addGroupToHand = (handIdx: number, isOr: boolean) => {
    setInputTargets(targets => targets.map((hand, idx) =>
      idx === handIdx ? [...hand, isOr ? { group: [], op: '=', count: 1 } : { group: [], op: '=', count: 1, single: true }] : hand
    ));
    setGroupSearchInputs(inputs => inputs.map((v, idx) => idx === handIdx ? [...v, ''] : v));
  };



  // Remove a group from a target hand
  const removeGroupFromHand = (handIdx: number, groupIdx: number) => {
    setInputTargets(targets => targets.map((hand, idx) =>
      idx === handIdx ? hand.filter((_, i) => i !== groupIdx) : hand
    ));
    setGroupSearchInputs(inputs => inputs.map((v, idx) => idx === handIdx ? v.filter((_, i) => i !== groupIdx) : v));
  };

  // Add a card to a group (single or OR)
  const addCardToGroup = (handIdx: number, groupIdx: number, card: { id: string; name: string }) => {
    setInputTargets(targets => targets.map((hand, idx) =>
      idx === handIdx ? hand.map((group, gIdx) => {
        if (gIdx !== groupIdx) return group;
        // If single group, only allow one card
        if ((group as any).single) return { ...group, group: [card] };
        return { ...group, group: [...group.group, card] };
      }) : hand
    ));
    setGroupSearchInputs(inputs => inputs.map((v, idx) => idx === handIdx ? v.map((s, gIdx) => gIdx === groupIdx ? '' : s) : v));
  };

  // Add a filter card to a group
  const addFilterCardToGroup = (handIdx: number, groupIdx: number) => {
    const filterId = `filter_${Date.now()}`;
    const filterCard: FilterCard = {
      id: filterId,
      name: `FILTER_${filterId.split('_')[1]}`,
      filterByAttribute: undefined,
      filterByType: undefined,
      filterByLevel: undefined,
      filterByATK: undefined
    };
    
    setInputTargets(targets => targets.map((hand, idx) =>
      idx === handIdx ? hand.map((group, gIdx) => {
        if (gIdx !== groupIdx) return group;
        return { ...group, group: [...group.group, filterCard] };
      }) : hand
    ));
  };

  // Remove a card from a group
  const removeCardFromGroup = (handIdx: number, groupIdx: number, cardIdx: number) => {
    setInputTargets(targets => targets.map((hand, idx) =>
      idx === handIdx ? hand.map((group, gIdx) => gIdx === groupIdx ? { ...group, group: group.group.filter((_, i) => i !== cardIdx) } : group) : hand
    ));
  };

  // Update a group condition
  const updateGroupCond = (handIdx: number, groupIdx: number, cond: Partial<HandCardCondition>) => {
    setInputTargets(targets => targets.map((hand, idx) =>
      idx === handIdx ? hand.map((g, i) => i === groupIdx ? { ...g, ...cond } : g) : hand
    ));
  };

  // Add/remove target hands
  const addTargetHand = () => {
    setInputTargets(targets => [...targets, []]);
    setGroupSearchInputs(inputs => [...inputs, []]);
  };
  const removeTargetHand = (idx: number) => {
    setInputTargets(targets => targets.filter((_, i) => i !== idx));
    setGroupSearchInputs(inputs => inputs.filter((_, i) => i !== idx));
  };

  // Run simulation
  const runSimulation = () => {
    setError('');
    if (deck.main.length < handSize) {
      setError('Deck does not have enough cards for the chosen hand size.');
      return;
    }
    if (!inputTargets.length || inputTargets.some(t => t.length === 0)) {
      setError('Please enter at least one valid target hand.');
      return;
    }
    setTargetHands(inputTargets);
    setRunning(true);
    setTimeout(() => {
      const counts = new Array(inputTargets.length).fill(0);
      for (let i = 0; i < numSim; ++i) {
        // Shuffle deck
        const shuffled = [...deck.main];
        for (let j = shuffled.length - 1; j > 0; --j) {
          const k = Math.floor(Math.random() * (j + 1));
          [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
        }
        const hand = shuffled.slice(0, handSize);
        // Get cardCache from localStorage
        let cardCache: Record<string, CardData> = {};
        try {
          const cache = JSON.parse(localStorage.getItem('cardCache') || '{}');
          cardCache = cache;
        } catch {}
        
        if (exclusiveMode) {
          // In exclusive mode, only count the first matching hand
          let handMatched = false;
          for (let idx = 0; idx < inputTargets.length; idx++) {
            if (handMatches(hand, inputTargets[idx], cardCache)) {
              counts[idx]++;
              handMatched = true;
              break; // Only count the first match
            }
          }
        } else {
          // In inclusive mode, count all matching hands
          inputTargets.forEach((conds, idx) => {
            if (handMatches(hand, conds, cardCache)) counts[idx]++;
          });
        }
      }
      setResults(counts);
      setRunning(false);
    }, 50);
  };

  // For each group, filter out cards already in that group
  const filteredCardsForGroup = (handIdx: number, groupIdx: number) => {
    // For single group, allow only one card and prevent duplicates within the same group
    if ((inputTargets[handIdx]?.[groupIdx] as any)?.single) {
      const usedIds = new Set(inputTargets[handIdx]?.flatMap(g => g.group.map(c => c.id)));
      return cardList.filter(card => !usedIds.has(card.id) || inputTargets[handIdx]?.[groupIdx]?.group.some(c => c.id === card.id));
    }
    // For OR groups, only prevent duplicates within the same group, allow reuse across different groups
    const currentGroupIds = new Set(inputTargets[handIdx]?.[groupIdx]?.group.map(c => c.id) || []);
    return cardList.filter(card => !currentGroupIds.has(card.id));
  };

  // Helper to get card image from cardCache
  const getCardImage = (id: string) => {
    try {
      const cache = JSON.parse(localStorage.getItem('cardCache') || '{}');
      return cache[id]?.image || '';
    } catch { return ''; }
  };

  // Draw a test hand (clear previous, reshuffle, and reset deck state)
  const drawTestHand = () => {
    setTestHandCards([]);
    setTestHandKey(k => k + 1);
    setTimeout(() => {
      if (deck.main.length < handSize) return;
      const shuffled = [...deck.main];
      for (let j = shuffled.length - 1; j > 0; --j) {
        const k = Math.floor(Math.random() * (j + 1));
        [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
      }
      const hand = shuffled.slice(0, handSize);
      setTestHandCards(hand.map(id => ({ id, name: cardNameMap[id], image: getCardImage(id) })));
    }, 50);
  };

  // Save current hand pattern
  const saveCurrentPattern = () => {
    if (inputTargets.length > 0 && inputTargets.some(h => h.length > 0)) setSavedPatterns(pats => [...pats, JSON.parse(JSON.stringify(inputTargets))]);
  };

  // Export saved patterns as JSON
  const exportPatterns = () => {
    const json = JSON.stringify(savedPatterns, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'saved_hand_patterns.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Upload patterns from JSON
  const uploadPatterns = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const pats = JSON.parse(ev.target?.result as string);
        if (Array.isArray(pats)) setSavedPatterns(pats);
      } catch {}
    };
    reader.readAsText(file);
  };

  // Load example patterns
  const loadExamplePattern = (type: 'vanquishSoul' | 'darkMonsters' | 'darkOrFire') => {
    if (type === 'vanquishSoul') {
      // Example: Vanquish Soul Razen + 1 or more DARK attribute monsters
      const example = [
        [
          {
            group: [{ id: 'vanquish_soul_razen', name: 'Vanquish Soul Razen' }],
            op: '=' as const,
            count: 1,
            unique: true
          },
          {
            group: [
              {
                id: 'filter_1',
                name: 'FILTER_1',
                filterByAttribute: 'DARK',
                filterByType: 'Effect Monster'
              }
            ],
            op: '>=' as const,
            count: 1
          }
        ]
      ];
      setInputTargets(example);
      setGroupSearchInputs(example.map(hand => hand.map(() => '')));
    } else if (type === 'darkMonsters') {
      // Example: 2 or more DARK attribute monsters
      const example = [
        [
          {
            group: [
              {
                id: 'filter_1',
                name: 'FILTER_1',
                filterByAttribute: 'DARK',
                filterByType: 'Effect Monster'
              }
            ],
            op: '>=' as const,
            count: 2
          }
        ]
      ];
      setInputTargets(example);
      setGroupSearchInputs(example.map(hand => hand.map(() => '')));
    } else if (type === 'darkOrFire') {
      // Example: 1 DARK OR 1 FIRE monster
      const example = [
        [
          {
            group: [
              {
                id: 'filter_1',
                name: 'FILTER_1',
                filterByAttribute: 'DARK',
                filterByType: 'Effect Monster'
              }
            ],
            op: '>=' as const,
            count: 1
          },
          {
            group: [
              {
                id: 'filter_2',
                name: 'FILTER_2',
                filterByAttribute: 'FIRE',
                filterByType: 'Effect Monster'
              }
            ],
            op: '>=' as const,
            count: 1
          }
        ]
      ];
      setInputTargets(example);
      setGroupSearchInputs(example.map(hand => hand.map(() => '')));
    }
  };

  // Modern style objects (no gradients)
  const styles = {
    card: {
      background: 'rgba(40, 44, 52, 0.97)',
      borderRadius: 14,
      boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      padding: 20,
      marginBottom: 18,
      transition: 'box-shadow 0.2s',
    },
    cardHover: {
      boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
    },
    button: {
      padding: '10px 24px',
      borderRadius: 8,
      background: '#3a3a7a',
      color: '#fff',
      border: 'none',
      fontWeight: 700,
      fontSize: 16,
      cursor: 'pointer',
      transition: 'background 0.2s, box-shadow 0.2s',
      boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    },
    buttonAccent: {
      background: '#2a7a3a',
    },
    buttonDanger: {
      background: '#c82840',
    },
    input: {
      padding: 8,
      borderRadius: 6,
      border: '1px solid #888',
      fontSize: 15,
      marginRight: 10,
      marginBottom: 6,
      background: '#23234a',
      color: '#fff',
      outline: 'none',
      transition: 'border 0.2s',
    },
    section: {
      background: 'rgba(30,30,40,0.92)',
      borderRadius: 16,
      padding: 32,
      margin: '0 auto',
      maxWidth: 950,
      boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
    },
    label: {
      fontWeight: 600,
      marginRight: 8,
      color: '#bbb',
    },
  };

  return (
    <div style={styles.section}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, color: '#fff', textShadow: '0 2px 8px #000' }}>Hand Simulation</h1>
        <button
          onClick={() => navigate('/')}
          style={{ ...styles.button, ...styles.buttonAccent }}
        >
          Back to Main
        </button>
      </div>
      <p style={{ color: '#bbb', marginBottom: 18, fontSize: 16, lineHeight: 1.5 }}>
        Simulate drawing hands from your current deck. You can define complex target hands using single cards or OR groups, specify copy counts and conditions, and see how often you draw them. Use the <b>Draw Test Hand</b> button to see a random hand instantly.
      </p>
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={styles.label}>Number of simulations:</label>
            <input
              type="number"
              min={1}
              max={100000}
              value={numSim}
              onChange={e => setNumSim(Number(e.target.value))}
              style={styles.input}
            />
            <label style={styles.label}>Hand size:</label>
            <input
              type="number"
              min={1}
              max={deck.main.length}
              value={handSize}
              onChange={e => setHandSize(Number(e.target.value))}
              style={styles.input}
            />
          </div>
          <button
            onClick={drawTestHand}
            style={styles.button}
          >
            Draw Test Hand
          </button>
          
          {/* Exclusive mode toggle */}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 14, color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={exclusiveMode}
                onChange={e => setExclusiveMode(e.target.checked)}
                style={{ margin: 0 }}
              />
              Exclusive Mode
            </label>
            <span style={{ fontSize: 12, color: '#888' }}>
              {exclusiveMode ? 'Count only first matching hand' : 'Count all matching hands'}
            </span>
          </div>
          <div style={{ marginTop: 10, marginBottom: 18 }} key={testHandKey}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Test Hand:</div>
            
            {/* Deck Composition Summary */}
            <div style={{ marginBottom: 16, padding: 8, background: 'rgba(40,40,60,0.3)', borderRadius: 6, fontSize: 12 }}>
              <div style={{ fontWeight: 600, color: '#aaa', marginBottom: 6 }}>Deck Composition:</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
                {(() => {
                  // Get cardCache from localStorage
                  let cardCache: Record<string, CardData> = {};
                  try {
                    const cache = JSON.parse(localStorage.getItem('cardCache') || '{}');
                    cardCache = cache;
                  } catch {}
                  
                  const composition = {
                    monsters: deck.main.filter(id => {
                      const card = cardCache[id];
                      return card?.type?.includes('Monster');
                    }).length,
                    spells: deck.main.filter(id => {
                      const card = cardCache[id];
                      return card?.type === 'Spell Card';
                    }).length,
                    traps: deck.main.filter(id => {
                      const card = cardCache[id];
                      return card?.type === 'Trap Card';
                    }).length,
                    dark: deck.main.filter(id => {
                      const card = cardCache[id];
                      return card?.attribute === 'DARK';
                    }).length,
                    light: deck.main.filter(id => {
                      const card = cardCache[id];
                      return card?.attribute === 'LIGHT';
                    }).length,
                  };
                  
                  return [
                    <div key="monsters" style={{ color: '#fff' }}>Monsters: {composition.monsters}</div>,
                    <div key="spells" style={{ color: '#fff' }}>Spells: {composition.spells}</div>,
                    <div key="traps" style={{ color: '#fff' }}>Traps: {composition.traps}</div>,
                    <div key="dark" style={{ color: '#aaa' }}>DARK: {composition.dark}</div>,
                    <div key="light" style={{ color: '#aaa' }}>LIGHT: {composition.light}</div>,
                  ];
                })()}
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              background: 'rgba(40,40,60,0.95)',
              borderRadius: 8,
              padding: 12,
              justifyItems: 'center',
              alignItems: 'center',
              maxWidth: 300,
              margin: '0 auto',
              minHeight: Math.ceil(handSize / 3) * 140
            }}>
              {Array.from({ length: Math.max(handSize, 3) }).map((_, i) => {
                const card = testHandCards[i];
                return card ? (
                  <div key={card.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
                    {card.image && <img src={card.image} alt={card.name} style={{ width: 70, height: 100, objectFit: 'cover', borderRadius: 4, marginBottom: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }} />}
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'center', textShadow: '0 1px 2px #000', whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</span>
                  </div>
                ) : (
                  <div key={i} style={{ minWidth: 80, minHeight: 120 }} />
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ flex: 2, minWidth: 320 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Target hands (add cards from your deck):</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            Use "Add Card" for specific cards or "Add OR Group" for multiple card options. You can add filter cards to groups to create conditions like "1 DARK OR 1 FIRE monster".
          </div>
          

          {inputTargets.map((hand, handIdx) => (
            <div key={handIdx} style={{ background: 'rgba(30,30,40,0.85)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: '#fff', fontSize: 16 }}>Hand {handIdx + 1}</span>
                <button
                  onClick={() => removeTargetHand(handIdx)}
                  style={{ marginLeft: 12, background: 'rgba(200,40,40,0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontWeight: 700, fontSize: 14, cursor: 'pointer', lineHeight: '20px', padding: 0 }}
                  title="Remove hand"
                  disabled={inputTargets.length === 1}
                >
                  ×
                </button>
              </div>
              {hand.map((group, groupIdx) => (
                <div key={groupIdx} style={{ background: 'rgba(50,50,80,0.95)', borderRadius: 6, padding: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>
                      {(group as any).single ? 'Card:' : `OR Group ${groupIdx + 1}:`}
                    </span>
                    <select value={group.op} onChange={e => updateGroupCond(handIdx, groupIdx, { op: e.target.value as any })} style={{ borderRadius: 4, border: '1px solid #888', fontSize: 13 }}>
                      <option value="=">=</option>
                      <option value="<=">≤</option>
                      <option value=">=">≥</option>
                      <option value="!=">Exclude</option>
                    </select>
                    {group.op !== '!=' && (
                      <input
                        type="number"
                        min={1}
                        max={group.group.reduce((sum, c) => sum + (cardCounts[c.id] || 1), 0) || 1}
                        value={group.count}
                        onChange={e => updateGroupCond(handIdx, groupIdx, { count: Number(e.target.value) })}
                        style={{ width: 40, borderRadius: 4, border: '1px solid #888', fontSize: 13 }}
                      />
                    )}
                    <button
                      onClick={() => removeGroupFromHand(handIdx, groupIdx)}
                      style={{ background: 'rgba(200,40,40,0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontWeight: 700, fontSize: 12, cursor: 'pointer', lineHeight: '16px', padding: 0 }}
                      title="Remove group"
                    >
                      ×
                    </button>
                  </div>
                  {/* Card display */}
                  {group.group.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {group.group.map((card, cardIdx) => (
                        <span key={cardIdx} style={{ 
                          background: 'filterByAttribute' in card ? '#7a3a2a' : '#234a7a', 
                          color: '#fff', 
                          borderRadius: 4, 
                          padding: '2px 8px', 
                          fontSize: 13, 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 4,
                          cursor: 'filterByAttribute' in card ? 'pointer' : 'default'
                        }}
                        onClick={() => {
                          if ('filterByAttribute' in card) {
                            // Show filter editing modal or expand filter details
                            setSelectedFilterCard({ handIdx, groupIdx, cardIdx, card });
                          }
                        }}
                        >
                          {card.name}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCardFromGroup(handIdx, groupIdx, cardIdx);
                            }}
                            style={{ background: 'rgba(200,40,40,0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, fontWeight: 700, fontSize: 11, cursor: 'pointer', lineHeight: '14px', padding: 0 }}
                            title="Remove card"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {!('single' in group) && (
                    <label style={{ fontSize: 13, color: '#bbb', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                      <input
                        type="checkbox"
                        checked={!!group.unique}
                        onChange={e => updateGroupCond(handIdx, groupIdx, { unique: e.target.checked })}
                        style={{ marginRight: 2 }}
                      />
                      Unique cards only
                    </label>
                  )}
                  {/* Card search for this group */}
                  <input
                    type="text"
                    value={groupSearchInputs[handIdx]?.[groupIdx] || ''}
                    onChange={e => setGroupSearchInputs(inputs => inputs.map((v, idx) => idx === handIdx ? v.map((s, gIdx) => gIdx === groupIdx ? e.target.value : s) : v))}
                    placeholder="Search card name..."
                    style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #888', fontSize: 14, marginTop: 4, marginBottom: 4 }}
                  />
                  

                  <div style={{ maxHeight: 60, overflowY: 'auto', marginBottom: 2 }}>
                    {filteredCardsForGroup(handIdx, groupIdx)
                      .filter(card => card.name.toLowerCase().includes((groupSearchInputs[handIdx]?.[groupIdx] || '').toLowerCase()))
                      .slice(0, 6)
                      .map(card => (
                        <button
                          key={card.id}
                          onClick={() => addCardToGroup(handIdx, groupIdx, card)}
                          style={{ marginRight: 6, marginBottom: 2, background: '#234a7a', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 13, cursor: 'pointer' }}
                        >
                          {card.name}
                        </button>
                      ))}
                  </div>
                  
                  {/* Add Filter Card Button */}
                  <button
                    onClick={() => addFilterCardToGroup(handIdx, groupIdx)}
                    style={{ marginTop: 8, padding: '4px 8px', borderRadius: 4, background: '#7a3a2a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                  >
                    + Add Filter Card
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => addGroupToHand(handIdx, false)}
                  style={{ padding: '4px 12px', borderRadius: 6, background: '#234a7a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
                >
                  Add Card
                </button>
                <button
                  onClick={() => addGroupToHand(handIdx, true)}
                  style={{ padding: '4px 12px', borderRadius: 6, background: '#3a3a7a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
                >
                  Add OR Group
                </button>

              </div>
            </div>
          ))}
          <button
            onClick={addTargetHand}
            style={{ marginTop: 4, padding: '4px 12px', borderRadius: 6, background: '#234a7a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
          >
            Add Target Hand
          </button>
          
          {/* Quick Probability Calculator */}
          <div style={{ marginTop: 16, padding: 12, background: 'rgba(40,40,60,0.3)', borderRadius: 6, border: '1px solid #555' }}>
            <div style={{ fontWeight: 600, color: '#aaa', marginBottom: 8 }}>Quick Probability Calculator</div>
            <div style={{ fontSize: 12, color: '#ccc', marginBottom: 8 }}>
              Calculate the probability of drawing specific cards together:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#ccc' }}>Card 1:</label>
                <select 
                  style={{ width: '100%', padding: 4, fontSize: 11, background: '#23234a', color: '#fff', border: '1px solid #555', borderRadius: 3, marginTop: 2 }}
                  onChange={e => {
                    const cardId = e.target.value;
                    if (cardId) {
                      // Get cardCache from localStorage
                      let cardCache: Record<string, CardData> = {};
                      try {
                        const cache = JSON.parse(localStorage.getItem('cardCache') || '{}');
                        cardCache = cache;
                      } catch {}
                      
                      const card = cardCache[cardId];
                      if (card) {
                        // Add a simple condition for this card
                        const newHand = [[{
                          group: [{ id: cardId, name: card.name }],
                          op: '=' as const,
                          count: 1,
                          unique: true
                        }]];
                        setInputTargets(newHand);
                        setGroupSearchInputs(newHand.map(hand => hand.map(() => '')));
                      }
                    }
                  }}
                >
                  <option value="">Select a card...</option>
                  {Object.keys(cardCounts).map(id => {
                    // Get cardCache from localStorage
                    let cardCache: Record<string, CardData> = {};
                    try {
                      const cache = JSON.parse(localStorage.getItem('cardCache') || '{}');
                      cardCache = cache;
                    } catch {}
                    
                    const card = cardCache[id];
                    return card ? (
                      <option key={id} value={id}>{card.name}</option>
                    ) : null;
                  })}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#ccc' }}>Card 2:</label>
                <select 
                  style={{ width: '100%', padding: 4, fontSize: 11, background: '#23234a', color: '#fff', border: '1px solid #555', borderRadius: 3, marginTop: 2 }}
                  onChange={e => {
                    const cardId = e.target.value;
                    if (cardId && inputTargets.length > 0 && inputTargets[0].length > 0) {
                      // Get cardCache from localStorage
                      let cardCache: Record<string, CardData> = {};
                      try {
                        const cache = JSON.parse(localStorage.getItem('cardCache') || '{}');
                        cardCache = cache;
                      } catch {}
                      
                      const card = cardCache[cardId];
                      if (card) {
                        // Add a second condition to the existing hand
                        const newHand = [...inputTargets[0], {
                          group: [{ id: cardId, name: card.name }],
                          op: '=' as const,
                          count: 1,
                          unique: true
                        }];
                        setInputTargets([newHand]);
                        setGroupSearchInputs([newHand.map(() => '')]);
                      }
                    }
                  }}
                >
                  <option value="">Select a card...</option>
                  {Object.keys(cardCounts).map(id => {
                    // Get cardCache from localStorage
                    let cardCache: Record<string, CardData> = {};
                    try {
                      const cache = JSON.parse(localStorage.getItem('cardCache') || '{}');
                      cardCache = cache;
                    } catch {}
                    
                    const card = cardCache[id];
                    return card ? (
                      <option key={id} value={id}>{card.name}</option>
                    ) : null;
                  })}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={runSimulation}
        disabled={running}
        style={styles.button}
      >
        {running ? 'Simulating...' : 'Run Simulation'}
      </button>
      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
      {results.length > 0 && (
        <div style={{ marginTop: 18, background: 'rgba(30,30,40,0.85)', borderRadius: 8, padding: 18 }}>
          <h3 style={{ marginBottom: 10 }}>Results</h3>
          {exclusiveMode && (
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(40,60,40,0.3)', borderRadius: 6, border: '1px solid #2a7a3a' }}>
              <div style={{ fontWeight: 600, color: '#2a7a3a', marginBottom: 6 }}>Exclusive Mode Active</div>
              <div style={{ fontSize: 14, color: '#ccc' }}>
                Only the first matching hand is counted. Total probability: <strong>{((results.reduce((sum, count) => sum + count, 0) / numSim) * 100).toFixed(2)}%</strong>
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
                This represents the probability of drawing ANY of the target hands (ONE HAND OR ANOTHER HAND).
              </div>
            </div>
          )}
          
          {/* Combined Probability Summary */}
          {!exclusiveMode && results.length > 1 && (
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(60,40,60,0.3)', borderRadius: 6, border: '1px solid #7a3a7a' }}>
              <div style={{ fontWeight: 600, color: '#7a3a7a', marginBottom: 6 }}>Combined Probability Analysis</div>
              <div style={{ fontSize: 14, color: '#ccc', marginBottom: 8 }}>
                Probability of drawing ANY target hand: <strong>{((results.reduce((sum, count) => sum + count, 0) / numSim) * 100).toFixed(2)}%</strong>
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>
                Note: In inclusive mode, a single hand can match multiple targets. Use exclusive mode for "ONE HAND OR ANOTHER HAND" probability.
              </div>
            </div>
          )}
          <table style={{ width: '100%', color: '#fff', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #444' }}>Target Hand</th>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #444' }}>Hits</th>
                <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #444' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {targetHands.map((hand, idx) => (
                <tr key={idx}>
                  <td style={{ padding: 6 }}>
                    {hand.map((group, i) => (
                      <div key={i} style={{ marginBottom: 8 }}>
                        <div style={{ marginBottom: 4 }}>
                          <b>{group.op !== '!=' ? `${group.count} of (` : 'Exclude ('}</b>
                          {group.group.map((card, j) => (
                            <span key={j} style={{}}>
                              {card.name}{j < group.group.length - 1 ? ' OR ' : ''}
                            </span>
                          ))}
                          <b>{')'}</b>
                        </div>

                      </div>
                    ))}
                  </td>
                  <td style={{ textAlign: 'right', padding: 6 }}>{results[idx]}</td>
                  <td style={{ textAlign: 'right', padding: 6 }}>{((results[idx] / numSim) * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 10, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <button onClick={saveCurrentPattern} style={{ padding: '6px 14px', borderRadius: 6, background: '#234a7a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Save Pattern</button>
          <button onClick={exportPatterns} style={{ padding: '6px 14px', borderRadius: 6, background: '#2a7a3a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Export Patterns</button>
          <label style={{ padding: '6px 14px', borderRadius: 6, background: '#3a3a7a', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', border: 'none', display: 'inline-block' }}>
            Upload Patterns
            <input type="file" accept=".json" onChange={uploadPatterns} style={{ display: 'none' }} />
          </label>
          <button onClick={() => loadExamplePattern('vanquishSoul')} style={{ padding: '6px 14px', borderRadius: 6, background: '#7a3a2a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Load Vanquish Soul Example</button>
          <button onClick={() => loadExamplePattern('darkMonsters')} style={{ padding: '6px 14px', borderRadius: 6, background: '#7a3a2a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Load DARK Monsters Example</button>
          <button onClick={() => loadExamplePattern('darkOrFire')} style={{ padding: '6px 14px', borderRadius: 6, background: '#7a3a2a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Load DARK OR FIRE Example</button>
        </div>
        {savedPatterns.length > 0 && (
          <div style={{ marginTop: 8, background: 'rgba(30,30,40,0.85)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Saved Patterns:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {savedPatterns.map((pattern, idx) => (
                <div key={idx} style={{ background: 'rgba(40,40,60,0.95)', borderRadius: 6, padding: 8, minWidth: 80, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Pattern {idx + 1}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {pattern.map((hand, i) => (
                      <span key={i} style={{ color: '#bbb', fontSize: 12 }}>
                        {hand.map((cond, j) => (
                          <span key={j} style={{ marginRight: 8 }}>
                            <b>{cond.op !== '!=' ? `${cond.count} of (` : 'Exclude ('}</b>
                            {cond.group.map((card, k) => (
                              <span key={k}>{card.name}{k < cond.group.length - 1 ? ' OR ' : ''}</span>
                            ))}
                            <b>)</b>
                          </span>
                        ))}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setInputTargets(JSON.parse(JSON.stringify(pattern)));
                      setGroupSearchInputs(
                        pattern.map(hand => hand.map(() => ''))
                      );
                    }}
                    style={{ marginTop: 8, padding: '4px 10px', borderRadius: 6, background: '#2a7a3a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Filter Card Editor Modal */}
      {selectedFilterCard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'rgba(40,40,60,0.95)',
            borderRadius: 12,
            padding: 24,
            maxWidth: 500,
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', margin: 0 }}>Edit Filter Card</h3>
              <button
                onClick={() => setSelectedFilterCard(null)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {/* Attribute filter */}
              <div>
                <label style={{ fontSize: 14, color: '#ccc', marginBottom: 6, display: 'block' }}>Attribute:</label>
                <select 
                  value={selectedFilterCard.card.filterByAttribute || ''} 
                  onChange={e => {
                    const newCard = { ...selectedFilterCard.card, filterByAttribute: e.target.value || undefined };
                    setInputTargets(targets => targets.map((hand, idx) =>
                      idx === selectedFilterCard.handIdx ? hand.map((group, gIdx) =>
                        gIdx === selectedFilterCard.groupIdx ? {
                          ...group,
                          group: group.group.map((card, cIdx) =>
                            cIdx === selectedFilterCard.cardIdx ? newCard : card
                          )
                        } : group
                      ) : hand
                    ));
                  }}
                  style={{ width: '100%', padding: 8, fontSize: 14, background: '#23234a', color: '#fff', border: '1px solid #555', borderRadius: 6 }}
                >
                  <option value="">Any</option>
                  <option value="DARK">DARK</option>
                  <option value="LIGHT">LIGHT</option>
                  <option value="EARTH">EARTH</option>
                  <option value="WATER">WATER</option>
                  <option value="FIRE">FIRE</option>
                  <option value="WIND">WIND</option>
                  <option value="DIVINE">DIVINE</option>
                </select>
              </div>
              
              {/* Type filter */}
              <div>
                <label style={{ fontSize: 14, color: '#ccc', marginBottom: 6, display: 'block' }}>Type:</label>
                <select 
                  value={selectedFilterCard.card.filterByType || ''} 
                  onChange={e => {
                    const newCard = { ...selectedFilterCard.card, filterByType: e.target.value || undefined };
                    setInputTargets(targets => targets.map((hand, idx) =>
                      idx === selectedFilterCard.handIdx ? hand.map((group, gIdx) =>
                        gIdx === selectedFilterCard.groupIdx ? {
                          ...group,
                          group: group.group.map((card, cIdx) =>
                            cIdx === selectedFilterCard.cardIdx ? newCard : card
                          )
                        } : group
                      ) : hand
                    ));
                  }}
                  style={{ width: '100%', padding: 8, fontSize: 14, background: '#23234a', color: '#fff', border: '1px solid #555', borderRadius: 6 }}
                >
                  <option value="">Any</option>
                  <option value="Normal Monster">Normal Monster</option>
                  <option value="Effect Monster">Effect Monster</option>
                  <option value="Ritual Monster">Ritual Monster</option>
                  <option value="Fusion Monster">Fusion Monster</option>
                  <option value="Synchro Monster">Synchro Monster</option>
                  <option value="XYZ Monster">XYZ Monster</option>
                  <option value="Link Monster">Link Monster</option>
                  <option value="Spell Card">Spell Card</option>
                  <option value="Trap Card">Trap Card</option>
                </select>
              </div>
              
              {/* Level filter */}
              <div>
                <label style={{ fontSize: 14, color: '#ccc', marginBottom: 6, display: 'block' }}>Level:</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    placeholder="Min"
                    value={selectedFilterCard.card.filterByLevel?.min || ''}
                    onChange={e => {
                      const newCard = { 
                        ...selectedFilterCard.card, 
                        filterByLevel: { 
                          ...selectedFilterCard.card.filterByLevel, 
                          min: e.target.value ? Number(e.target.value) : undefined 
                        } 
                      };
                      setInputTargets(targets => targets.map((hand, idx) =>
                        idx === selectedFilterCard.handIdx ? hand.map((group, gIdx) =>
                          gIdx === selectedFilterCard.groupIdx ? {
                            ...group,
                            group: group.group.map((card, cIdx) =>
                              cIdx === selectedFilterCard.cardIdx ? newCard : card
                            )
                          } : group
                        ) : hand
                      ));
                    }}
                    style={{ width: '50%', padding: 8, fontSize: 14, background: '#23234a', color: '#fff', border: '1px solid #555', borderRadius: 6 }}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={selectedFilterCard.card.filterByLevel?.max || ''}
                    onChange={e => {
                      const newCard = { 
                        ...selectedFilterCard.card, 
                        filterByLevel: { 
                          ...selectedFilterCard.card.filterByLevel, 
                          max: e.target.value ? Number(e.target.value) : undefined 
                        } 
                      };
                      setInputTargets(targets => targets.map((hand, idx) =>
                        idx === selectedFilterCard.handIdx ? hand.map((group, gIdx) =>
                          gIdx === selectedFilterCard.groupIdx ? {
                            ...group,
                            group: group.group.map((card, cIdx) =>
                              cIdx === selectedFilterCard.cardIdx ? newCard : card
                            )
                          } : group
                        ) : hand
                      ));
                    }}
                    style={{ width: '50%', padding: 8, fontSize: 14, background: '#23234a', color: '#fff', border: '1px solid #555', borderRadius: 6 }}
                  />
                </div>
              </div>
              
              {/* ATK filter */}
              <div>
                <label style={{ fontSize: 14, color: '#ccc', marginBottom: 6, display: 'block' }}>ATK:</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    placeholder="Min"
                    value={selectedFilterCard.card.filterByATK?.min || ''}
                    onChange={e => {
                      const newCard = { 
                        ...selectedFilterCard.card, 
                        filterByATK: { 
                          ...selectedFilterCard.card.filterByATK, 
                          min: e.target.value ? Number(e.target.value) : undefined 
                        } 
                      };
                      setInputTargets(targets => targets.map((hand, idx) =>
                        idx === selectedFilterCard.handIdx ? hand.map((group, gIdx) =>
                          gIdx === selectedFilterCard.groupIdx ? {
                            ...group,
                            group: group.group.map((card, cIdx) =>
                              cIdx === selectedFilterCard.cardIdx ? newCard : card
                            )
                          } : group
                        ) : hand
                      ));
                    }}
                    style={{ width: '50%', padding: 8, fontSize: 14, background: '#23234a', color: '#fff', border: '1px solid #555', borderRadius: 6 }}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={selectedFilterCard.card.filterByATK?.max || ''}
                    onChange={e => {
                      const newCard = { 
                        ...selectedFilterCard.card, 
                        filterByATK: { 
                          ...selectedFilterCard.card.filterByATK, 
                          max: e.target.value ? Number(e.target.value) : undefined 
                        } 
                      };
                      setInputTargets(targets => targets.map((hand, idx) =>
                        idx === selectedFilterCard.handIdx ? hand.map((group, gIdx) =>
                          gIdx === selectedFilterCard.groupIdx ? {
                            ...group,
                            group: group.group.map((card, cIdx) =>
                              cIdx === selectedFilterCard.cardIdx ? newCard : card
                            )
                          } : group
                        ) : hand
                      ));
                    }}
                    style={{ width: '50%', padding: 8, fontSize: 14, background: '#23234a', color: '#fff', border: '1px solid #555', borderRadius: 6 }}
                  />
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button
                onClick={() => setSelectedFilterCard(null)}
                style={{ padding: '10px 20px', borderRadius: 6, background: '#2a7a3a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AppMain() {
  const { user, isAuthenticated } = useAuth();
  const [deck, setDeck] = useState<DeckSections>(() => {
    try {
      const saved = localStorage.getItem('deck');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { main: [], extra: [], side: [] };
  });
  const [cardCache, setCardCache] = useState<Record<string, CardData>>({});
  const fetchedIds = useRef<Set<string>>(new Set());
  const [addCardTarget, setAddCardTarget] = useState<CardSearchResult | null>(null);
  const [addCardQuantity, setAddCardQuantity] = useState(1);
  const [addCardError, setAddCardError] = useState('');
  const [sortAlpha, setSortAlpha] = useState(false);
  const [deckName, setDeckName] = useState('');
  const [savedDecks, setSavedDecks] = useState<string[]>([]);
  const [loadMenuOpen, setLoadMenuOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showDeckManager, setShowDeckManager] = useState(false);
  const navigate = useNavigate();

  // Save deck to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('deck', JSON.stringify(deck));
    } catch {}
  }, [deck]);

  // Save cardCache to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('cardCache', JSON.stringify(cardCache));
    } catch {}
  }, [cardCache]);

  // Fetch card data for all unique IDs in the deck
  useEffect(() => {
    const allIds = Array.from(new Set([...deck.main, ...deck.extra, ...deck.side]));
    const idsToFetch = allIds.filter(id => id && !cardCache[id] && !fetchedIds.current.has(id));
    if (idsToFetch.length === 0) return;
    idsToFetch.forEach(id => fetchedIds.current.add(id));
    // YGOPRODeck API allows multiple IDs separated by commas
    fetch(YGOPRO_API + idsToFetch.join(','))
      .then(res => res.json())
      .then(data => {
        if (!data.data) return;
        const newCache: Record<string, CardData> = {};
        for (const card of data.data) {
          newCache[card.id] = {
            id: String(card.id),
            name: card.name,
            image: card.card_images?.[0]?.image_url || '',
            attribute: card.attribute,
            level: card.level,
            type: card.type,
            race: card.race,
            atk: card.atk,
            def: card.def,
            desc: card.desc,
            archetype: card.archetype,
          };
        }
        setCardCache(prev => ({ ...prev, ...newCache }));
      })
      .catch(() => {});
  }, [deck, cardCache]);

  // Load saved deck names from localStorage
  useEffect(() => {
    try {
      const all = Object.keys(localStorage)
        .filter(k => k.startsWith('deck:'))
        .map(k => k.slice(5));
      setSavedDecks(all);
    } catch {}
  }, [deck]);

  const handleAddCard = (card: CardSearchResult) => {
    setAddCardTarget(card);
    setAddCardQuantity(1);
    setAddCardError('');
  };

  const getTotalCopies = (id: string) => {
    return [deck.main, deck.extra, deck.side].reduce((sum, arr) => sum + arr.filter(x => x === id).length, 0);
  };

  const confirmAddCard = (section: keyof DeckSections) => {
    if (!addCardTarget) return;
    const total = getTotalCopies(addCardTarget.id);
    if (total >= 3) {
      setAddCardError('You cannot have more than 3 copies of a card across all decks.');
      return;
    }
    const toAdd = Math.min(addCardQuantity, 3 - total);
    if (toAdd <= 0) {
      setAddCardError('You cannot add more copies of this card.');
      return;
    }
    setDeck(prev => ({
      ...prev,
      [section]: [...prev[section], ...Array(toAdd).fill(addCardTarget.id)],
    }));
    setCardCache(prev => ({
      ...prev,
      [addCardTarget.id]: {
        id: addCardTarget.id,
        name: addCardTarget.name,
        image: addCardTarget.image,
        attribute: addCardTarget.attribute,
        level: addCardTarget.level,
        type: addCardTarget.type,
        race: addCardTarget.race,
        atk: addCardTarget.atk,
        def: addCardTarget.def,
        desc: addCardTarget.desc,
        archetype: addCardTarget.archetype,
      },
    }));
    setAddCardTarget(null);
    setAddCardError('');
  };

  const handleRemoveCard = (section: keyof DeckSections, idx: number) => {
    setDeck(prev => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== idx),
    }));
  };

  // Drag-and-drop state for drop indicator
  const [dragOverSection, setDragOverSection] = useState<keyof DeckSections | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dropHandled = useRef(false);

  // Handle drag start for deck cards
  const handleCardDragStart = (id: string, section: keyof DeckSections, idx: number, e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-card-id', JSON.stringify({ id, from: 'deck', section, idx }));
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  };
  // Handle drag end
  const handleCardDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setDragOverSection(null);
    setDragOverIdx(null);
  };
  // Handle drag over a deck section (empty area)
  const handleSectionDragOver = (section: keyof DeckSections, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSection(section);
    setDragOverIdx(deck[section].length); // highlight as if dropping at end
  };
  // Handle drag over a card slot
  const handleCardDragOver = (section: keyof DeckSections, idx: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSection(section);
    setDragOverIdx(idx);
  };
  // Handle drop on a card slot (insert at idx)
  const handleCardDrop = (section: keyof DeckSections, idx: number, e: React.DragEvent) => {
    dropHandled.current = true;
    e.preventDefault();
    setDragOverSection(null);
    setDragOverIdx(null);
    const data = e.dataTransfer.getData('application/x-card-id');
    if (!data) return;
    let parsed: any;
    try { parsed = JSON.parse(data); } catch { return; }
    if (!parsed || !parsed.id) return;
    if (parsed.from === 'search') {
      if (getTotalCopies(parsed.id) >= 3) return;
      setDeck(prev => ({
        ...prev,
        [section]: [...prev[section].slice(0, idx), parsed.id, ...prev[section].slice(idx)],
      }));
      setAddCardTarget(null);
    } else if (parsed.from === 'deck') {
      if (parsed.section === section) {
        if (parsed.idx === idx) return;
        const ids = [...deck[section]];
        const [removed] = ids.splice(parsed.idx, 1);
        ids.splice(idx, 0, removed);
        setDeck(prev => ({ ...prev, [section]: ids }));
      } else {
        setDeck(prev => ({
          ...prev,
          [parsed.section as keyof DeckSections]: prev[parsed.section as keyof DeckSections].filter((_: any, i: number) => i !== parsed.idx),
          [section]: [...prev[section].slice(0, idx), parsed.id, ...prev[section].slice(idx)],
        }));
      }
    }
  };

  const handleSectionDrop = (section: keyof DeckSections, e: React.DragEvent) => {
    if (dropHandled.current) {
      dropHandled.current = false;
      return;
    }
    e.preventDefault();
    setDragOverSection(null);
    setDragOverIdx(null);
    const data = e.dataTransfer.getData('application/x-card-id');
    if (!data) return;
    let parsed: any;
    try { parsed = JSON.parse(data); } catch { return; }
    if (!parsed || !parsed.id) return;
    if (parsed.from === 'search') {
      if (getTotalCopies(parsed.id) >= 3) return;
      setDeck(prev => ({
        ...prev,
        [section]: [...prev[section], parsed.id],
      }));
      setAddCardTarget(null);
    } else if (parsed.from === 'deck') {
      if (parsed.section === section) {
        if (typeof parsed.idx !== 'number' || parsed.idx === deck[section].length - 1) return;
        const ids = [...deck[section]];
        const [removed] = ids.splice(parsed.idx, 1);
        ids.push(removed);
        setDeck(prev => ({ ...prev, [section]: ids }));
      } else {
        setDeck(prev => ({
          ...prev,
          [parsed.section as keyof DeckSections]: prev[parsed.section as keyof DeckSections].filter((_: any, i: number) => i !== parsed.idx),
          [section]: [...prev[section], parsed.id],
        }));
      }
    }
  };

  const renderDeckSection = (ids: string[], title: string, section: keyof DeckSections) => {
    let displayIds = ids;
    if (sortAlpha) {
      displayIds = [...ids].sort((a, b) => {
        const nameA = cardCache[a]?.name || '';
        const nameB = cardCache[b]?.name || '';
        return nameA.localeCompare(nameB);
      });
    }
    // Responsive: always 10 cards per row, grid fills available width
    return (
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 12 }}>{title}</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(10, 1fr)',
            gap: 16,
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 12,
            padding: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            overflowX: 'auto',
            transition: 'background 0.2s',
          }}
          onDragOver={e => handleSectionDragOver(section, e)}
          onDrop={e => handleSectionDrop(section, e)}
        >
          {displayIds.map((id, idx) => {
            const card = cardCache[id];
            const showDrop = dragOverSection === section && dragOverIdx === idx;
            return (
              <React.Fragment key={id + '-' + idx}>
                {showDrop && (
                  <div style={{
                    gridColumn: 'span 1',
                    height: 0,
                    borderTop: '3px solid #2a7a3a',
                    marginBottom: 4,
                    borderRadius: 2,
                    transition: 'border 0.2s',
                  }} />
                )}
                <div
                  draggable
                  onDragStart={e => handleCardDragStart(id, section, idx, e)}
                  onDragEnd={handleCardDragEnd}
                  onDragOver={e => handleCardDragOver(section, idx, e)}
                  onDrop={e => handleCardDrop(section, idx, e)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'rgba(30,30,40,0.85)',
                    borderRadius: 8,
                    padding: 8,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
                    minHeight: 150,
                    minWidth: 0,
                    transition: 'transform 0.15s, background 0.2s',
                    cursor: 'grab',
                    border: '1px solid #23234a',
                    position: 'relative',
                  }}
                >
                  <button
                    onClick={() => handleRemoveCard(section, ids.indexOf(id))}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      background: '#c82840',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: 22,
                      height: 22,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      zIndex: 2,
                      lineHeight: '20px',
                      padding: 0,
                    }}
                    title="Remove card"
                  >
                    ×
                  </button>
                  {card ? (
                    <>
                      <img
                        src={card.image}
                        alt={card.name}
                        style={{
                          width: 70,
                          height: 100,
                          objectFit: 'cover',
                          borderRadius: 4,
                          marginBottom: 8,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                        }}
                      />
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: '#fff',
                          textAlign: 'center',
                          marginBottom: 2,
                          textShadow: '0 1px 2px #000',
                        }}
                      >
                        {card.name}
                      </span>
                      <span style={{ color: '#aaa', fontSize: 11, textAlign: 'center' }}>({id})</span>
                    </>
                  ) : (
                    <span style={{ color: '#888', fontSize: 12 }}>Loading...<br/>({id})</span>
                  )}
                </div>
              </React.Fragment>
            );
          })}
          {dragOverSection === section && dragOverIdx === displayIds.length && (
            <div style={{
              gridColumn: 'span 1',
              height: 0,
              borderTop: '3px solid #2a7a3a',
              marginBottom: 4,
              borderRadius: 2,
              transition: 'border 0.2s',
            }} />
          )}
        </div>
      </div>
    );
  };

  // Export deck as YDK file
  const handleExport = () => {
    const toSection = (name: string, ids: string[]) =>
      ids.length ? `#${name}\n${ids.join('\n')}` : '';
    const ydk = [
      '#created by handWeb',
      toSection('main', deck.main),
      toSection('extra', deck.extra),
      deck.side.length ? '!side\n' + deck.side.join('\n') : '',
    ]
      .filter(Boolean)
      .join('\n');
    const blob = new Blob([ydk], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deck.ydk';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Save current deck under a name
  const handleSaveDeck = () => {
    if (!deckName.trim()) return;
    try {
      localStorage.setItem('deck:' + deckName.trim(), JSON.stringify(deck));
      setSavedDecks(prev => Array.from(new Set([...prev, deckName.trim()])));
      setDeckName('');
    } catch {}
  };

  // Load a deck by name
  const handleLoadDeck = (name: string) => {
    try {
      const data = localStorage.getItem('deck:' + name);
      if (data) setDeck(JSON.parse(data));
      setLoadMenuOpen(false);
    } catch {}
  };

  // Clear current deck
  const handleClearDeck = () => {
    setDeck({ main: [], extra: [], side: [] });
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', background: 'linear-gradient(120deg, #23234a 0%, #1a1a2a 100%)', margin: 0, padding: 0, boxSizing: 'border-box', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
            {/* Sidebar */}
            <div style={{ flex: '0 0 300px', background: 'rgba(20,20,30,0.97)', padding: 24, display: 'flex', flexDirection: 'column', gap: 24, boxShadow: '2px 0 16px rgba(0,0,0,0.12)', height: '100vh', boxSizing: 'border-box', zIndex: 2, overflowY: 'auto' }}>
              <div style={{ height: 12 }} />
              <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: 1, marginBottom: 8, color: '#fff', textShadow: '0 2px 8px #000' }}>Yu-Gi-Oh! Deck Analyzer</h1>
              
              {/* Authentication Component */}
              <Auth 
                onAuthChange={(user) => {
                  // This will be handled by the AuthContext
                }}
                currentUser={user}
              />
              
              <UploadYDK onDeckParsed={setDeck} />
              <button
                onClick={() => setSortAlpha(s => !s)}
                style={{ marginBottom: 12, padding: '10px 0', borderRadius: 6, background: '#3a3a7a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer', width: '100%' }}
              >
                {sortAlpha ? 'Unsort' : 'Sort Alphabetically'}
              </button>
              <button
                onClick={handleExport}
                style={{ marginBottom: 12, padding: '10px 0', borderRadius: 6, background: '#2a7a3a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer', width: '100%' }}
              >
                Export Deck (.ydk)
              </button>
              <button
                onClick={handleClearDeck}
                style={{ marginBottom: 12, padding: '10px 0', borderRadius: 6, background: '#7a2a2a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer', width: '100%' }}
              >
                Clear Deck
              </button>
              <button
                onClick={() => navigate('/hand-sim')}
                style={{ marginBottom: 12, padding: '10px 0', borderRadius: 6, background: '#234a7a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer', width: '100%' }}
              >
                Hand Simulation
              </button>
              
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                style={{ marginBottom: 12, padding: '10px 0', borderRadius: 6, background: '#7a3a2a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer', width: '100%' }}
              >
                {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
              </button>
              
              <button
                onClick={() => setShowDeckManager(!showDeckManager)}
                style={{ marginBottom: 12, padding: '10px 0', borderRadius: 6, background: '#3a7a2a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer', width: '100%' }}
              >
                {showDeckManager ? 'Hide Deck Manager' : 'Deck Manager'}
              </button>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  value={deckName}
                  onChange={e => setDeckName(e.target.value)}
                  placeholder="Deck name"
                  style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #888', fontSize: 15 }}
                />
                <button
                  onClick={handleSaveDeck}
                  style={{ padding: '8px 12px', borderRadius: 6, background: '#234a7a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
                >
                  Save
                </button>
              </div>
              <button
                onClick={() => setLoadMenuOpen(v => !v)}
                style={{ marginBottom: 12, padding: '10px 0', borderRadius: 6, background: '#3a3a7a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer', width: '100%' }}
              >
                {loadMenuOpen ? 'Hide Decks' : 'Load Deck'}
              </button>
              {loadMenuOpen && (
                <div style={{ background: 'rgba(30,30,40,0.95)', borderRadius: 8, padding: 12, marginBottom: 12, maxHeight: 180, overflowY: 'auto' }}>
                  {savedDecks.length === 0 && <div style={{ color: '#bbb', fontSize: 14 }}>No saved decks</div>}
                  {savedDecks.map(name => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <button
                        onClick={() => handleLoadDeck(name)}
                        style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', color: '#fff', fontSize: 15, cursor: 'pointer', padding: 4, borderRadius: 4 }}
                      >
                        {name}
                      </button>
                      <button
                        onClick={() => { localStorage.removeItem('deck:' + name); setSavedDecks(decks => decks.filter(d => d !== name)); }}
                        style={{ background: 'rgba(200,40,40,0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontWeight: 700, fontSize: 14, cursor: 'pointer', lineHeight: '20px', padding: 0 }}
                        title="Delete deck"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Main Content */}
            <div style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', boxSizing: 'border-box', padding: 0, margin: 0, zIndex: 1 }}>
              {addCardTarget && (
                <div style={{ background: 'rgba(20,20,30,0.97)', position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: '#23234a', borderRadius: 12, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.25)', minWidth: 320, textAlign: 'center' }}>
                    <h3 style={{ color: '#fff', marginBottom: 16 }}>Add "{addCardTarget.name}" to:</h3>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ color: '#fff', fontWeight: 600, marginRight: 8 }}>Copies:</label>
                      <input
                        type="number"
                        min={1}
                        max={3 - getTotalCopies(addCardTarget.id)}
                        value={addCardQuantity}
                        onChange={e => setAddCardQuantity(Math.max(1, Math.min(3 - getTotalCopies(addCardTarget.id), Number(e.target.value))))}
                        style={{ width: 50, borderRadius: 4, border: '1px solid #888', fontSize: 16, padding: 4, textAlign: 'center' }}
                      />
                      <span style={{ color: '#bbb', fontSize: 13, marginLeft: 8 }}>
                        (Max {3 - getTotalCopies(addCardTarget.id)} more)
                      </span>
                    </div>
                    {addCardError && <div style={{ color: 'red', marginBottom: 8 }}>{addCardError}</div>}
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 16 }}>
                      <button onClick={() => confirmAddCard('main')} style={{ padding: '8px 18px', borderRadius: 6, background: '#3a3a7a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Main Deck</button>
                      <button onClick={() => confirmAddCard('extra')} style={{ padding: '8px 18px', borderRadius: 6, background: '#3a3a7a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Extra Deck</button>
                      <button onClick={() => confirmAddCard('side')} style={{ padding: '8px 18px', borderRadius: 6, background: '#3a3a7a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Side Deck</button>
                    </div>
                    <button onClick={() => setAddCardTarget(null)} style={{ marginTop: 8, color: '#fff', background: 'none', border: 'none', fontSize: 15, textDecoration: 'underline', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
              {/* Analytics Dashboard */}
              {showAnalytics && (
                <div style={{ marginBottom: 24 }}>
                  <AnalyticsDashboard deck={deck} onClose={() => setShowAnalytics(false)} />
                </div>
              )}
              
              {/* Deck Manager */}
              {showDeckManager && (
                <div style={{ marginBottom: 24 }}>
                  <DeckManager 
                    currentDeck={deck} 
                    onDeckLoad={setDeck} 
                    onClose={() => setShowDeckManager(false)} 
                  />
                </div>
              )}
              
              <div style={{ width: '90vw', maxWidth: 1100, background: 'rgba(20,20,30,0.85)', borderRadius: 16, padding: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', overflowX: 'auto', margin: 0, boxSizing: 'border-box' }}>
                {renderDeckSection(deck.main, 'Main Deck', 'main')}
                {renderDeckSection(deck.extra, 'Extra Deck', 'extra')}
                {renderDeckSection(deck.side, 'Side Deck', 'side')}
              </div>
              
              {/* AI Chatbot */}
              <AIChatbot />
            </div>
            {/* Right Sidebar for Card Search */}
            <div style={{ flex: '0 0 300px', background: 'rgba(20,20,30,0.97)', padding: 24, display: 'flex', flexDirection: 'column', gap: 24, boxShadow: '-2px 0 16px rgba(0,0,0,0.12)', height: '100vh', boxSizing: 'border-box', zIndex: 2, overflowY: 'auto' }}>
              <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Card Search</h2>
              <CardSearch onCardSelect={handleAddCard} />
            </div>
          </div>
        }
      />
      <Route path="/hand-sim" element={<HandSimulation deck={deck} />} />
      

    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppMain />
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#23234a',
              color: '#fff',
              border: '1px solid #3a3a7a'
            },
            success: {
              style: {
                background: '#2a7a3a',
                border: '1px solid #3a7a3a'
              }
            },
            error: {
              style: {
                background: '#7a2a2a',
                border: '1px solid #7a3a3a'
              }
            }
          }}
        />
      </Router>
    </AuthProvider>
  );
}

export default App
