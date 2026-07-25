import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Quordle.module.css';

export default function Quordle() {
  return (
    <div className={styles.container}>
      <h1>💣 Quordle Component Working!</h1>
      <p>This is the separate Quordle game file.</p>
      <Link to="/" className={styles.backLink}>← Back to Home</Link>
    </div>
  );
}