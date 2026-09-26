// src/components/Navbar.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import logoImg from '../assets/logo.webp';
import './Navbar.css';

export default function Navbar({ title }) {
  return (
    <header className="navbar">
      <Link to="/" className="logo-link" title="Back to Home">
        <img src={logoImg} alt="Skeeter Games Logo" width="128" height="128" className="header-logo" />
      </Link>
    </header>
  );
}