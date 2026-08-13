// src/components/Navbar.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import logoImg from '../assets/logo.jpg';
import './Navbar.css';

export default function Navbar({ title }) {
  return (
    <header className="navbar">
      <Link to="/" className="logo-link" title="Back to Home">
        <img src={logoImg} alt="Skeeter Games Logo" className="header-logo" />
      </Link>
    </header>
  );
}