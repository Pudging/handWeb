import React, { useState, useEffect } from 'react';

export type CardSearchResult = {
  id: string;
  name: string;
  image: string;
};

interface CardSearchProps {
  onCardSelect: (card: CardSearchResult) => void;
}

const YGOPRO_API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=';

const CardSearch: React.FC<CardSearchProps> = ({ onCardSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const handler = setTimeout(() => {
      fetch(YGOPRO_API + encodeURIComponent(query.trim()))
        .then(res => res.json())
        .then(data => {
          if (!data.data) {
            setError('No results found.');
            setResults([]);
          } else {
            setResults(
              data.data.map((card: any) => ({
                id: String(card.id),
                name: card.name,
                image: card.card_images?.[0]?.image_url || '',
              }))
            );
          }
        })
        .catch(() => setError('Error fetching cards.'))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(handler);
  }, [query]);

  return (
    <div style={{ marginBottom: 0 }}>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search for a card by name..."
        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #888', fontSize: 16, marginBottom: 12, boxSizing: 'border-box' }}
      />
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {query.trim() && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 320, overflowY: 'auto', width: '100%' }}>
          {results.map(card => (
            <div key={card.id} style={{ background: 'rgba(30,30,40,0.85)', borderRadius: 8, padding: 8, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.10)', width: '100%' }}>
              <img src={card.image} alt={card.name} style={{ width: 60, height: 90, objectFit: 'cover', borderRadius: 4, marginBottom: 6 }} />
              <div style={{ fontWeight: 600, color: '#fff', fontSize: 13, marginBottom: 4, wordBreak: 'break-word' }}>{card.name}</div>
              <button onClick={() => onCardSelect(card)} style={{ padding: '4px 10px', borderRadius: 4, background: '#3a3a7a', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer', width: '100%' }}>
                Add
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CardSearch; 