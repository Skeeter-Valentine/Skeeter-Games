import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Minesweeper.module.css';

export default function Minesweeper() {
  return (
    <div className={styles.container}>
      <h1>💣 Minesweeper Component Working!</h1>
      <p>This is the separate Minesweeper game file.</p>
      <Link to="/" className={styles.backLink}>← Back to Home</Link>
    </div>
  );
}