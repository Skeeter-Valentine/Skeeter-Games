import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LandingPage.module.css';

const GAMES = [
  {
    id: 'minesweeper',
    title: 'Minesweeper',
    path: '/minesweeper',
    category: 'Logic',
    desc: 'Clear the grid without detonating hidden mines.',
    icon: '💣'
  },
  {
    id: 'quordle',
    title: 'Quordle',
    path: '/quordle',
    category: 'Word',
    desc: 'Solve 4 word puzzles simultaneously in 9 tries.',
    icon: '🔤'
  },
  {
    id: 'word500',
    title: 'Word500',
    path: '/word500',
    category: 'Deduction',
    desc: 'Guess the hidden word using color hints.',
    icon: '🧩'
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    path: '/sudoku',
    category: 'Numbers',
    desc: 'Fill the 9x9 grid so every row contains 1–9.',
    icon: '🔢'
  }
];

export default function LandingPage() {
  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link to="/" className={styles.logo}>
            🧠 Mind Arcade
          </Link>
          <div className={styles.streakBadge}>
            🔥 <span style={{ color: '#f59e0b' }}>5 Day Streak</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Daily Mini-Games</h1>
          <p className={styles.heroSubtitle}>
            Train your brain daily with quick word, number, and logic puzzles.
          </p>
        </section>

        {/* Game Cards Grid */}
        <div className={styles.grid}>
          {GAMES.map((game) => (
            <Link key={game.id} to={game.path} className={styles.card}>
              <div>
                <div className={styles.cardTop}>
                  <span className={styles.icon}>{game.icon}</span>
                  <span className={styles.badge}>{game.category}</span>
                </div>
                <h2 className={styles.gameTitle}>{game.title}</h2>
                <p className={styles.description}>{game.desc}</p>
              </div>
              <div className={styles.playBtn}>Play Now →</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}