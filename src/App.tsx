import { useState, useEffect, useRef, useMemo } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

import './App.css'
import UploadYDK from './UploadYDK'
import type { DeckSections } from './UploadYDK'
import CardSearch from './CardSearch'
import type { CardSearchResult } from './CardSearch'
import { useState as useSimState } from 'react';

// YGOPRODeck API endpoint for card info by ID
const YGOPRO_API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?id=';

type CardData = {
  id: string;
  name: string;
  image: string;
};

type HandCardCondition = {
  group: { id: string; name: string }[];
  op: '=' | '<=' | '>=' | '!=';
  count: number;
};

function handMatches(hand: string[], conditions: HandCardCondition[]) {
  const counts: Record<string, number> = {};
  for (const id of hand) counts[id] = (counts[id] || 0) + 1;
  for (const cond of conditions) {
    // For OR group: sum counts for all cards in group
    const groupCount = cond.group.reduce((sum, card) => sum + (counts[card.id] || 0), 0);
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
  const [testHand, setTestHand] = useSimState<string[]>([]);
  const [testHandCards, setTestHandCards] = useSimState<{id: string, name: string, image?: string}[]>([]);
  const [testHandKey, setTestHandKey] = useSimState(0);
  const [savedHands, setSavedHands] = useSimState<string[][]>([]);

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

  // Target hand builder state: each hand is an array of OR groups (HandCardCondition)
  const [inputTargets, setInputTargets] = useSimState<HandCardCondition[][]>([[]]);
  const [groupSearchInputs, setGroupSearchInputs] = useSimState<string[][]>([[]]);

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
        inputTargets.forEach((conds, idx) => {
          if (handMatches(hand, conds)) counts[idx]++;
        });
      }
      setResults(counts);
      setRunning(false);
    }, 50);
  };

  // For each group, filter out cards already in that group
  const filteredCardsForGroup = (handIdx: number, groupIdx: number) => {
    const usedIds = new Set(inputTargets[handIdx]?.flatMap(g => g.group.map(c => c.id)));
    // For single group, allow only one card
    if ((inputTargets[handIdx]?.[groupIdx] as any)?.single) {
      return cardList.filter(card => !usedIds.has(card.id) || inputTargets[handIdx]?.[groupIdx]?.group.some(c => c.id === card.id));
    }
    return cardList.filter(card => !usedIds.has(card.id));
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
    setTestHand([]);
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
      setTestHand(hand);
      setTestHandCards(hand.map(id => ({ id, name: cardNameMap[id], image: getCardImage(id) })));
    }, 50);
  };

  // Save current test hand
  const saveCurrentHand = () => {
    if (testHand.length > 0) setSavedHands(hands => [...hands, [...testHand]]);
  };

  // Export saved hands as txt
  const exportHands = () => {
    const txt = savedHands.map(hand => hand.join(",")).join("\n");
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'saved_hands.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Upload hands from txt
  const uploadHands = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const hands = text.split(/\r?\n/).map(line => line.split(',').map(s => s.trim()).filter(Boolean)).filter(arr => arr.length > 0);
      setSavedHands(hands);
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ color: '#fff', padding: 32, maxWidth: 900, margin: '0 auto', background: 'rgba(20,20,30,0.92)', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, color: '#fff', textShadow: '0 2px 8px #000' }}>Hand Simulation</h1>
      <p style={{ color: '#bbb', marginBottom: 18, fontSize: 16, lineHeight: 1.5 }}>
        Simulate drawing hands from your current deck. You can define complex target hands using single cards or OR groups, specify copy counts and conditions, and see how often you draw them. Use the <b>Draw Test Hand</b> button to see a random hand instantly.
      </p>
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, marginRight: 8 }}>Number of simulations:</label>
            <input
              type="number"
              min={1}
              max={100000}
              value={numSim}
              onChange={e => setNumSim(Number(e.target.value))}
              style={{ width: 100, padding: 6, borderRadius: 4, border: '1px solid #888', fontSize: 15, marginRight: 16 }}
            />
            <label style={{ fontWeight: 600, marginRight: 8 }}>Hand size:</label>
            <input
              type="number"
              min={1}
              max={deck.main.length}
              value={handSize}
              onChange={e => setHandSize(Number(e.target.value))}
              style={{ width: 60, padding: 6, borderRadius: 4, border: '1px solid #888', fontSize: 15 }}
            />
          </div>
          <button
            onClick={drawTestHand}
            style={{ marginBottom: 18, padding: '10px 24px', borderRadius: 6, background: '#3a3a7a', color: '#fff', border: 'none', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}
          >
            Draw Test Hand
          </button>
          <div style={{ marginTop: 10, marginBottom: 18 }} key={testHandKey}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Test Hand:</div>
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
            <div style={{ display: 'flex', gap: 8, marginTop: 10, marginBottom: 10 }}>
              <button onClick={saveCurrentHand} style={{ padding: '6px 14px', borderRadius: 6, background: '#234a7a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Save Hand</button>
              <button onClick={exportHands} style={{ padding: '6px 14px', borderRadius: 6, background: '#2a7a3a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Export Hands</button>
              <label style={{ padding: '6px 14px', borderRadius: 6, background: '#3a3a7a', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', border: 'none', display: 'inline-block' }}>
                Upload Hands
                <input type="file" accept=".txt" onChange={uploadHands} style={{ display: 'none' }} />
              </label>
            </div>
            {savedHands.length > 0 && (
              <div style={{ marginTop: 8, background: 'rgba(30,30,40,0.85)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Saved Hands:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {savedHands.map((hand, idx) => (
                    <div key={idx} style={{ background: 'rgba(40,40,60,0.95)', borderRadius: 6, padding: 8, minWidth: 80, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Hand {idx + 1}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {hand.map((id, i) => (
                          <span key={i} style={{ background: '#234a7a', color: '#fff', borderRadius: 4, padding: '2px 6px', fontSize: 12 }}>{cardNameMap[id] || id}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ flex: 2, minWidth: 320 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Target hands (add cards from your deck):</div>
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
                    <span style={{ fontWeight: 600 }}>{(group as any).single ? 'Card:' : `OR Group ${groupIdx + 1}:`}</span>
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
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {group.group.map((card, cardIdx) => (
                      <span key={cardIdx} style={{ background: '#234a7a', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {card.name}
                        <button
                          onClick={() => removeCardFromGroup(handIdx, groupIdx, cardIdx)}
                          style={{ background: 'rgba(200,40,40,0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, fontWeight: 700, fontSize: 11, cursor: 'pointer', lineHeight: '14px', padding: 0 }}
                          title="Remove card"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
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
        </div>
      </div>
      <button
        onClick={runSimulation}
        disabled={running}
        style={{ marginTop: 8, marginBottom: 18, padding: '10px 24px', borderRadius: 6, background: '#2a7a3a', color: '#fff', border: 'none', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}
      >
        {running ? 'Simulating...' : 'Run Simulation'}
      </button>
      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
      {results.length > 0 && (
        <div style={{ marginTop: 18, background: 'rgba(30,30,40,0.85)', borderRadius: 8, padding: 18 }}>
          <h3 style={{ marginBottom: 10 }}>Results</h3>
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
                      <span key={i} style={{ marginRight: 12 }}>
                        <b>{group.op !== '!=' ? `${group.count} of (` : 'Exclude ('}</b>
                        {group.group.map((card, j) => (
                          <span key={j} style={{}}>
                            {card.name}{j < group.group.length - 1 ? ' OR ' : ''}
                          </span>
                        ))}
                        <b>{')'}</b>
                      </span>
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
    </div>
  );
}

function AppMain() {
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
          }}
        >
          {displayIds.map((id, idx) => {
            const card = cardCache[id];
            return (
              <div
                key={id + '-' + idx}
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
                  transition: 'transform 0.15s',
                  cursor: 'pointer',
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
                    background: 'rgba(200,40,40,0.85)',
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
            );
          })}
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
            <div style={{ flex: '0 0 300px', background: 'rgba(20,20,30,0.97)', padding: 24, display: 'flex', flexDirection: 'column', gap: 24, boxShadow: '2px 0 16px rgba(0,0,0,0.12)', minHeight: '100vh', height: '100vh', boxSizing: 'border-box', zIndex: 2 }}>
              <div style={{ height: 12 }} />
              <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: 1, marginBottom: 8, color: '#fff', textShadow: '0 2px 8px #000' }}>Yu-Gi-Oh! Deck Analyzer</h1>
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
              <div style={{ width: '90vw', maxWidth: 1100, background: 'rgba(20,20,30,0.85)', borderRadius: 16, padding: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', overflowX: 'auto', margin: 0, boxSizing: 'border-box' }}>
                {renderDeckSection(deck.main, 'Main Deck', 'main')}
                {renderDeckSection(deck.extra, 'Extra Deck', 'extra')}
                {renderDeckSection(deck.side, 'Side Deck', 'side')}
              </div>
            </div>
            {/* Right Sidebar for Card Search */}
            <div style={{ flex: '0 0 300px', background: 'rgba(20,20,30,0.97)', padding: 24, display: 'flex', flexDirection: 'column', gap: 24, boxShadow: '-2px 0 16px rgba(0,0,0,0.12)', minHeight: '100vh', height: '100vh', boxSizing: 'border-box', zIndex: 2 }}>
              <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Card Search</h2>
              <CardSearch
                onCardSelect={handleAddCard}
              />
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
    <Router>
      <AppMain />
    </Router>
  );
}

export default App
