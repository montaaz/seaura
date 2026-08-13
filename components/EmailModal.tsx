"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X as CloseIcon, ArrowRight } from "lucide-react";
import Swal from "sweetalert2";
import styles from "./EmailModal.module.css";
import { useUser } from "./Providers";

export default function EmailModal() {
    const { isEmailModalOpen, setIsEmailModalOpen, setUserEmail, markEmailModalSeen } = useUser();
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Visual is editable from the admin Live Editor. Falls back to the bundled
    // asset so the modal always renders, even before the CMS value loads.
    const [visual, setVisual] = useState("/images/hero.png");

    // Fetched when the modal opens rather than on mount: this component is
    // always rendered, and the image is only needed once it is actually shown.
    useEffect(() => {
        if (!isEmailModalOpen) return;
        let cancelled = false;
        fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ homeContent { key value } }' })
        })
            .then(res => res.json())
            .then(data => {
                if (cancelled) return;
                const row = (data.data?.homeContent || []).find((c: any) => c.key === 'newsletter_modal_image');
                if (row?.value) setVisual(row.value);
            })
            .catch(() => { });
        return () => { cancelled = true; };
    }, [isEmailModalOpen]);

    if (!isEmailModalOpen) return null;

    // Closing counts as "seen" so the modal is never auto-opened again.
    const closeModal = () => {
        markEmailModalSeen();
        setIsEmailModalOpen(false);
    };

    const handleSubscribe = async () => {
        if (!email || !email.includes('@')) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Veuillez entrer une adresse e-mail valide.',
                confirmButtonColor: '#000'
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `mutation($email: String!) { subscribeNewsletter(email: $email) }`,
                    variables: { email }
                })
            });
            const data = await res.json();
            if (data.data?.subscribeNewsletter) {
                Swal.fire({
                    icon: 'success',
                    title: 'Succès',
                    text: 'Merci pour votre inscription !',
                    confirmButtonColor: '#000'
                });
                setUserEmail(email);
                localStorage.setItem('seaura_user_email', email);
                closeModal();
            }
        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Une erreur est survenue. Veuillez réessayer.',
                confirmButtonColor: '#000'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <button className={styles.modalClose} onClick={closeModal}>
                    <CloseIcon size={24} />
                </button>

                <div className={styles.modalBody}>
                    <div className={styles.modalVisual}>
                        <Image src={visual} alt="Join Seaura" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                    </div>

                    <div className={styles.modalText}>
                        <span className={styles.modalSubtitle}>Collection Exclusive</span>
                        <h2 className={styles.modalTitle}>Rejoindre l'Expérience</h2>
                        <p className={styles.modalDesc}>Inscrivez-vous pour recevoir nos dernières actualités et offres exclusives directement dans votre boîte mail.</p>

                        <div className={styles.modalInputWrapper}>
                            <input
                                type="email"
                                placeholder="VOTRE E-MAIL"
                                className={styles.modalInput}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
                            />
                            <button className={styles.modalSubmit} onClick={handleSubscribe} disabled={isSubmitting}>
                                <ArrowRight size={20} />
                            </button>
                        </div>

                        <p className={styles.modalLegal}>
                            En vous inscrivant, vous acceptez notre <a href="#">Politique de Confidentialité</a>.
                        </p>
                    </div>
                </div>
            </div>
            <div className={styles.modalBackdrop} onClick={closeModal}></div>
        </div>
    );
}
