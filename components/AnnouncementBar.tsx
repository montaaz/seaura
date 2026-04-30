"use client";

import React from 'react';
import styles from './AnnouncementBar.module.css';

interface AnnouncementBarProps {
  text: string;
}

const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ text }) => {
  if (!text) return null;

  return (
    <div className={styles.announcementBar}>
      <div className={styles.marquee}>
        <div className={styles.marqueeContent}>
          {[...Array(10)].map((_, i) => (
            <span key={i} className={styles.text}>{text}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnnouncementBar;
