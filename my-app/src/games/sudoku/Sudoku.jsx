import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Sudoku.module.css';

export default function Sudoku() {
  return (
    <div className={styles.container}>
      <h1>💣 Sudoku Component Working!</h1>
      <p>This is the separate Sudoku game file.</p>
      <Link to="/" className={styles.backLink}>← Back to Home</Link>
    </div>
  );
}