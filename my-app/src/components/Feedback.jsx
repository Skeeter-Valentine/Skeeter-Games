import React, { useState } from 'react';
import emailjs from '@emailjs/browser';

export default function FeedbackForm() {
  const [feedback, setFeedback] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'success' | 'error'

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus('sending');

    const templateParams = {
      message: feedback,
      user_email: userEmail || 'Anonymous',
    };

    emailjs
      .send(
        'service_3k55br5',
        'template_lixpuem',
        templateParams,
        '3TlrvHCOTwxqiNjOG'
      )
      .then(
        () => {
          setStatus('success');
          setFeedback('');
          setUserEmail('');
        },
        (error) => {
          console.error('Failed to send feedback:', error);
          setStatus('error');
        }
      );
  };

  return (
    <div style={styles.container}>
      <h3>Skeetergames.org is a new app. Any and all feedback is appreciated!</h3>
      {status === 'success' ? (
        <p style={styles.successMessage}>Thank you for your feedback!</p>
      ) : (
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Your email (optional)"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            style={styles.input}
          />
          <textarea
            required
            rows={4}
            placeholder="Tell us what you think..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            style={styles.textarea}
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            style={styles.button}
          >
            {status === 'sending' ? 'Sending...' : 'Send Feedback'}
          </button>
          {status === 'error' && (
            <p style={styles.errorMessage}>Failed to send. Please try again.</p>
          )}
        </form>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '400px',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #ccc',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
  },
  textarea: {
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    resize: 'vertical',
  },
  button: {
    padding: '10px',
    backgroundColor: '#0070f3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  successMessage: {
    color: 'green',
  },
  errorMessage: {
    color: 'red',
  },
};