import React, { useState, useEffect, useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, RadialLinearScale, BarElement } from 'chart.js';
import { Line, Bar, Doughnut, Radar, Scatter } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

// Register Chart.js components
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend,
  ArcElement, RadialLinearScale, BarElement
);

interface DeckStats {
  totalCards: number;
  monsters: number;
  spells: number;
  traps: number;
  dark: number;
  light: number;
  earth: number;
  water: number;
  fire: number;
  wind: number;
  levels: { [key: number]: number };
  averageLevel: number;
  averageATK: number;
  averageDEF: number;
}

interface PerformanceMetrics {
  winRate: number;
  consistency: number;
  powerLevel: number;
  adaptability: number;
  resourceManagement: number;
  comboPotential: number;
}

interface SimulationResult {
  date: Date;
  successRate: number;
  totalSimulations: number;
  targetHands: number;
}

interface AnalyticsDashboardProps {
  deck: any;
  onClose?: () => void;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ deck, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('7d');
  const [simulationResults, setSimulationResults] = useState<SimulationResult[]>([]);

  // Generate mock simulation data
  useEffect(() => {
    const generateMockData = () => {
      const results: SimulationResult[] = [];
      const now = new Date();
      
      for (let i = 30; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        results.push({
          date,
          successRate: Math.random() * 40 + 30, // 30-70%
          totalSimulations: Math.floor(Math.random() * 100) + 50,
          targetHands: Math.floor(Math.random() * 5) + 1
        });
      }
      
      setSimulationResults(results);
    };

    generateMockData();
  }, []);

  // Calculate deck composition statistics
  const deckStats = useMemo((): DeckStats => {
    if (!deck || !deck.main) return {
      totalCards: 0, monsters: 0, spells: 0, traps: 0,
      dark: 0, light: 0, earth: 0, water: 0, fire: 0, wind: 0,
      levels: {}, averageLevel: 0, averageATK: 0, averageDEF: 0
    };

    const stats: DeckStats = {
      totalCards: deck.main.length,
      monsters: 0,
      spells: 0,
      traps: 0,
      dark: 0,
      light: 0,
      earth: 0,
      water: 0,
      fire: 0,
      wind: 0,
      levels: {},
      averageLevel: 0,
      averageATK: 0,
      averageDEF: 0
    };

    let totalLevel = 0;
    let totalATK = 0;
    let totalDEF = 0;
    let monsterCount = 0;

    // Get cardCache from localStorage
    let cardCache: any = {};
    try {
      const cache = JSON.parse(localStorage.getItem('cardCache') || '{}');
      cardCache = cache;
    } catch {}

    deck.main.forEach((cardId: string) => {
      const card = cardCache[cardId];
      if (card) {
        // Count card types
        if (card.type?.includes('Monster')) {
          stats.monsters++;
          monsterCount++;
          
          // Count attributes
          if (card.attribute === 'DARK') stats.dark++;
          else if (card.attribute === 'LIGHT') stats.light++;
          else if (card.attribute === 'EARTH') stats.earth++;
          else if (card.attribute === 'WATER') stats.water++;
          else if (card.attribute === 'FIRE') stats.fire++;
          else if (card.attribute === 'WIND') stats.wind++;

          // Count levels
          if (card.level) {
            stats.levels[card.level] = (stats.levels[card.level] || 0) + 1;
            totalLevel += card.level;
          }

          // Sum ATK/DEF
          if (card.atk) totalATK += card.atk;
          if (card.def) totalDEF += card.def;
        } else if (card.type === 'Spell Card') {
          stats.spells++;
        } else if (card.type === 'Trap Card') {
          stats.traps++;
        }
      }
    });

    stats.averageLevel = monsterCount > 0 ? totalLevel / monsterCount : 0;
    stats.averageATK = monsterCount > 0 ? totalATK / monsterCount : 0;
    stats.averageDEF = monsterCount > 0 ? totalDEF / monsterCount : 0;

    return stats;
  }, [deck]);

  // Calculate performance metrics
  const performanceMetrics = useMemo((): PerformanceMetrics => {
    const stats = deckStats;
    
    // Win rate based on deck composition
    const winRate = Math.min(100, Math.max(20, 
      (stats.monsters / stats.totalCards) * 40 + 
      (stats.spells / stats.totalCards) * 35 + 
      (stats.traps / stats.totalCards) * 25
    ));

    // Consistency based on card ratios
    const consistency = Math.min(100, Math.max(20,
      (stats.monsters / Math.max(1, stats.totalCards)) * 100 - 
      Math.abs((stats.monsters / Math.max(1, stats.totalCards)) - 0.6) * 50
    ));

    // Power level based on average ATK and levels
    const powerLevel = Math.min(100, Math.max(20,
      (stats.averageATK / 2000) * 40 + 
      (stats.averageLevel / 8) * 30 + 
      (stats.monsters / Math.max(1, stats.totalCards)) * 30
    ));

    // Adaptability based on spell/trap ratio
    const adaptability = Math.min(100, Math.max(20,
      (stats.spells / Math.max(1, stats.totalCards)) * 50 + 
      (stats.traps / Math.max(1, stats.totalCards)) * 50
    ));

    // Resource management based on card count
    const resourceManagement = Math.min(100, Math.max(20,
      Math.max(0, 100 - Math.abs(stats.totalCards - 40) * 2)
    ));

    // Combo potential based on monster variety
    const comboPotential = Math.min(100, Math.max(20,
      (Object.keys(stats.levels).length / 8) * 100
    ));

    return {
      winRate: Math.round(winRate),
      consistency: Math.round(consistency),
      powerLevel: Math.round(powerLevel),
      adaptability: Math.round(adaptability),
      resourceManagement: Math.round(resourceManagement),
      comboPotential: Math.round(comboPotential)
    };
  }, [deckStats]);

  // Chart data
  const cardTypeChartData = {
    labels: ['Monsters', 'Spells', 'Traps'],
    datasets: [{
      data: [deckStats.monsters, deckStats.spells, deckStats.traps],
      backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1'],
      borderColor: ['#ff5252', '#26a69a', '#1976d2'],
      borderWidth: 2
    }]
  };

  const attributeChartData = {
    labels: ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND'],
    datasets: [{
      label: 'Monster Count',
      data: [deckStats.dark, deckStats.light, deckStats.earth, deckStats.water, deckStats.fire, deckStats.wind],
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 2
    }]
  };

  const levelChartData = {
    labels: Object.keys(deckStats.levels).map(level => `Level ${level}`),
    datasets: [{
      label: 'Monster Count',
      data: Object.values(deckStats.levels),
      backgroundColor: 'rgba(255, 99, 132, 0.6)',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 2
    }]
  };

  const simulationChartData = {
    labels: simulationResults.map(result => format(result.date, 'MMM dd')),
    datasets: [{
      label: 'Success Rate (%)',
      data: simulationResults.map(result => result.successRate),
      borderColor: 'rgba(75, 192, 192, 1)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      tension: 0.4
    }]
  };

  const performanceRadarData = {
    labels: ['Win Rate', 'Consistency', 'Power Level', 'Adaptability', 'Resource Mgmt', 'Combo Potential'],
    datasets: [{
      label: 'Deck Performance',
      data: [
        performanceMetrics.winRate,
        performanceMetrics.consistency,
        performanceMetrics.powerLevel,
        performanceMetrics.adaptability,
        performanceMetrics.resourceManagement,
        performanceMetrics.comboPotential
      ],
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 2,
      pointBackgroundColor: 'rgba(54, 162, 235, 1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(54, 162, 235, 1)'
    }]
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'composition', label: 'Composition', icon: '🎴' },
    { id: 'performance', label: 'Performance', icon: '📈' },
    { id: 'simulations', label: 'Simulations', icon: '🎲' },
    { id: 'recommendations', label: 'Tips', icon: '💡' }
  ];

  const getRecommendations = () => {
    const recommendations = [];
    
    if (deckStats.totalCards < 35) {
      recommendations.push('Consider adding more cards to reach the optimal 40-card deck size for better consistency.');
    } else if (deckStats.totalCards > 45) {
      recommendations.push('Your deck might be too large. Consider trimming to 40 cards for better consistency.');
    }

    if (deckStats.monsters / deckStats.totalCards < 0.5) {
      recommendations.push('Your deck has relatively few monsters. Consider adding more monsters for better board presence.');
    } else if (deckStats.monsters / deckStats.totalCards > 0.8) {
      recommendations.push('Your deck is very monster-heavy. Consider adding more spells and traps for better control.');
    }

    if (deckStats.spells / deckStats.totalCards < 0.2) {
      recommendations.push('Consider adding more spell cards for better consistency and combo potential.');
    }

    if (deckStats.traps / deckStats.totalCards < 0.1) {
      recommendations.push('Adding some trap cards could improve your defensive options and control.');
    }

    if (performanceMetrics.consistency < 50) {
      recommendations.push('Your deck consistency is low. Consider balancing card ratios and adding more copies of key cards.');
    }

    if (performanceMetrics.adaptability < 40) {
      recommendations.push('Your deck could benefit from more flexible cards that can adapt to different situations.');
    }

    return recommendations.length > 0 ? recommendations : ['Your deck looks well-balanced! Keep up the good work.'];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'rgba(40, 44, 52, 0.97)',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        maxWidth: 1200,
        margin: '0 auto'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ color: '#fff', margin: 0, fontSize: 28, fontWeight: 700 }}>
          📊 Deck Analytics Dashboard
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: 24,
              cursor: 'pointer',
              padding: 8
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              background: activeTab === tab.id ? '#2a7a3a' : 'rgba(60,60,80,0.8)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}
        >
          {/* Key Stats */}
          <div style={{
            background: 'rgba(30,30,40,0.8)',
            borderRadius: 12,
            padding: 20,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 32, color: '#2a7a3a', marginBottom: 8 }}>🎴</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              {deckStats.totalCards}
            </div>
            <div style={{ color: '#888', fontSize: 14 }}>Total Cards</div>
          </div>

          <div style={{
            background: 'rgba(30,30,40,0.8)',
            borderRadius: 12,
            padding: 20,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 32, color: '#ff6b6b', marginBottom: 8 }}>⚔️</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              {deckStats.monsters}
            </div>
            <div style={{ color: '#888', fontSize: 14 }}>Monsters</div>
          </div>

          <div style={{
            background: 'rgba(30,30,40,0.8)',
            borderRadius: 12,
            padding: 20,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 32, color: '#4ecdc4', marginBottom: 8 }}>✨</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              {deckStats.spells}
            </div>
            <div style={{ color: '#888', fontSize: 14 }}>Spells</div>
          </div>

          <div style={{
            background: 'rgba(30,30,40,0.8)',
            borderRadius: 12,
            padding: 20,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 32, color: '#45b7d1', marginBottom: 8 }}>🕳️</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              {deckStats.traps}
            </div>
            <div style={{ color: '#888', fontSize: 14 }}>Traps</div>
          </div>

          {/* Performance Overview */}
          <div style={{
            gridColumn: 'span 2',
            background: 'rgba(30,30,40,0.8)',
            borderRadius: 12,
            padding: 20
          }}>
            <h3 style={{ color: '#fff', marginBottom: 16, fontSize: 18 }}>Performance Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#2a7a3a', fontSize: 20, fontWeight: 700 }}>
                  {performanceMetrics.winRate}%
                </div>
                <div style={{ color: '#888', fontSize: 12 }}>Win Rate</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#4ecdc4', fontSize: 20, fontWeight: 700 }}>
                  {performanceMetrics.consistency}%
                </div>
                <div style={{ color: '#888', fontSize: 12 }}>Consistency</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#ff6b6b', fontSize: 20, fontWeight: 700 }}>
                  {performanceMetrics.powerLevel}%
                </div>
                <div style={{ color: '#888', fontSize: 12 }}>Power Level</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Composition Tab */}
      {activeTab === 'composition' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}
        >
          <div style={{
            background: 'rgba(30,30,40,0.8)',
            borderRadius: 12,
            padding: 20
          }}>
            <h3 style={{ color: '#fff', marginBottom: 16, fontSize: 18 }}>Card Type Distribution</h3>
            <div style={{ height: 300 }}>
              <Doughnut data={cardTypeChartData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { labels: { color: '#fff' } }
                }
              }} />
            </div>
          </div>

          <div style={{
            background: 'rgba(30,30,40,0.8)',
            borderRadius: 12,
            padding: 20
          }}>
            <h3 style={{ color: '#fff', marginBottom: 16, fontSize: 18 }}>Attribute Distribution</h3>
            <div style={{ height: 300 }}>
              <Bar data={attributeChartData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { labels: { color: '#fff' } }
                },
                scales: {
                  y: { ticks: { color: '#fff' } },
                  x: { ticks: { color: '#fff' } }
                }
              }} />
            </div>
          </div>

          <div style={{
            background: 'rgba(30,30,40,0.8)',
            borderRadius: 12,
            padding: 20
          }}>
            <h3 style={{ color: '#fff', marginBottom: 16, fontSize: 18 }}>Level Distribution</h3>
            <div style={{ height: 300 }}>
              <Bar data={levelChartData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { labels: { color: '#fff' } }
                },
                scales: {
                  y: { ticks: { color: '#fff' } },
                  x: { ticks: { color: '#fff' } }
                }
              }} />
            </div>
          </div>

          <div style={{
            background: 'rgba(30,30,40,0.8)',
            borderRadius: 12,
            padding: 20
          }}>
            <h3 style={{ color: '#fff', marginBottom: 16, fontSize: 18 }}>Deck Statistics</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#ccc' }}>Average Level:</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>{deckStats.averageLevel.toFixed(1)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#ccc' }}>Average ATK:</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>{deckStats.averageATK.toFixed(0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#ccc' }}>Average DEF:</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>{deckStats.averageDEF.toFixed(0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#ccc' }}>Monster Ratio:</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>
                  {((deckStats.monsters / deckStats.totalCards) * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#ccc' }}>Spell Ratio:</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>
                  {((deckStats.spells / deckStats.totalCards) * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#ccc' }}>Trap Ratio:</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>
                  {((deckStats.traps / deckStats.totalCards) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: 24 }}
        >
          <div style={{
            background: 'rgba(30,30,40,0.8)',
            borderRadius: 12,
            padding: 20
          }}>
            <h3 style={{ color: '#fff', marginBottom: 16, fontSize: 18 }}>Performance Radar</h3>
            <div style={{ height: 400 }}>
              <Radar data={performanceRadarData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { labels: { color: '#fff' } }
                },
                scales: {
                  r: {
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    pointLabels: { color: '#fff' }
                  }
                }
              }} />
            </div>
          </div>

          <div style={{
            background: 'rgba(30,30,40,0.8)',
            borderRadius: 12,
            padding: 20
          }}>
            <h3 style={{ color: '#fff', marginBottom: 16, fontSize: 18 }}>Performance Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(performanceMetrics).map(([key, value]) => (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: '#ccc', textTransform: 'capitalize' }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{value}%</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: 8,
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: 4,
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${value}%`,
                      height: '100%',
                      background: value > 70 ? '#2a7a3a' : value > 40 ? '#ffa500' : '#ff6b6b',
                      borderRadius: 4,
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Simulations Tab */}
      {activeTab === 'simulations' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}
        >
          <div style={{
            background: 'rgba(30,30,40,0.8)',
            borderRadius: 12,
            padding: 20
          }}>
            <h3 style={{ color: '#fff', marginBottom: 16, fontSize: 18 }}>Simulation Results Over Time</h3>
            <div style={{ height: 400 }}>
              <Line data={simulationChartData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { labels: { color: '#fff' } }
                },
                scales: {
                  y: { 
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                  },
                  x: { 
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                  }
                }
              }} />
            </div>
          </div>
        </motion.div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}
        >
          <div style={{
            background: 'rgba(30,30,40,0.8)',
            borderRadius: 12,
            padding: 20
          }}>
            <h3 style={{ color: '#fff', marginBottom: 16, fontSize: 18 }}>💡 Deck Improvement Tips</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {getRecommendations().map((recommendation, index) => (
                <div key={index} style={{
                  padding: '16px',
                  background: 'rgba(60,60,80,0.5)',
                  borderRadius: 8,
                  borderLeft: '4px solid #4ecdc4'
                }}>
                  <div style={{ color: '#fff', fontSize: 14, lineHeight: 1.5 }}>
                    {recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default AnalyticsDashboard;
