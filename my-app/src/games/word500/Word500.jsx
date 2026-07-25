import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Word500.module.css';

export default function Word500() {
  return (
    <div className={styles.container}>
      <h1>💣 Word500 Component Working!</h1>
      <p>This is the separate Word500 game file.</p>
      <Link to="/" className={styles.backLink}>← Back to Home</Link>
    </div>
  );
}