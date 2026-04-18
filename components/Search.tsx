"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./Search.module.css";
import Image from "next/image";
import Link from "next/link";
import { Search as SearchIcon, X } from "lucide-react";

interface SearchProps {
  isScrolled: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export default function Search({ isScrolled, onOpenChange }: SearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync open state to parent if needed
  useEffect(() => {
    if (onOpenChange) onOpenChange(isOpen);
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Debounced search logic
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query($term: String!) { searchProducts(term: $term) { id name price image_url } }`,
            variables: { term: query }
          })
        });
        const data = await res.json();
        setResults(data.data?.searchProducts || []);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleClose = () => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  return (
    <div className={`${styles.searchActiveContainer} ${isOpen ? styles.searchActive : ""}`}>
      <div className={styles.searchWrapper}>
        <div 
          className={`${styles.searchPill} ${isScrolled ? styles.pillScrolled : ""} ${isOpen ? styles.pillActive : ""}`}
          onClick={() => !isOpen && setIsOpen(true)}
        >
          <SearchIcon className={styles.searchIcon} size={18} />
          <input
            ref={inputRef}
            type="text"
            placeholder="RECHERCHE"
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => !isOpen && setIsOpen(true)}
          />
        </div>
        {isOpen && (
          <button className={styles.cancelButton} onClick={handleClose}>
            Annuler
          </button>
        )}
      </div>

      {isOpen && (
        <div className={styles.searchBackdrop} onClick={handleClose}>
          <div className={styles.searchModalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.searchInner}>
              <div className={styles.modalHeader}>
                <h4 className={styles.trendingTitle}>
                  {query ? (isSearching ? "RECHERCHE EN COURS..." : (results.length > 0 ? "RÉSULTATS" : "AUCUN RÉSULTAT")) : "RECHERCHES TENDANCES"}
                </h4>
                <button className={styles.closeModalBtn} onClick={handleClose}>
                  <X size={18} strokeWidth={1} />
                </button>
              </div>
              
              {query ? (
                <div className={styles.searchResults}>
                  <div className={styles.resultsGrid}>
                    {results.map(product => (
                      <Link 
                        key={product.id} 
                        href={`/shop/${product.id}`} 
                        className={styles.productResultItem}
                        onClick={handleClose}
                      >
                        <div className={styles.resultImage}>
                          <Image src={product.image_url || "/images/hero.png"} alt={product.name} fill sizes="80px" />
                        </div>
                        <div className={styles.resultInfo}>
                          <p className={styles.resultName}>{product.name}</p>
                          <p className={styles.resultPrice}>{product.price} €</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.tagCloud}>
                  {['sacs', 'chaussures', 'bijoux', 'vêtements', 'nouvelle collection', 'bijoux en acier', 'sacs à main'].map(tag => (
                    <span key={tag} className={styles.searchTag} onClick={() => setQuery(tag)}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
