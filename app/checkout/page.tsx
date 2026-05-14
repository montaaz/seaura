"use client";

import { useState, useEffect } from "react";
import styles from "./checkout.module.css";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, FileText, Truck, Tag, CreditCard, ShoppingBag } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

export default function CheckoutPage() {
    const router = useRouter();
    const [cart, setCart] = useState<any[]>([]);
    const [wishlist, setWishlist] = useState<any[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [paymentAccepted, setPaymentAccepted] = useState(false);
    const [orderSummary, setOrderSummary] = useState<any>(null);

    // Form State
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        country: "Tunisie",
        address: "",
        apartment: "",
        city: "",
        region: "",
        zipCode: "",
        phone: "",
        email: "",
        emergencyPhone: "",
        acceptTerms: false
    });

    const [categories, setCategories] = useState<any[]>([]);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await fetch('/api/graphql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: '{ categories { id name } }' })
                });
                const data = await res.json();
                if (data.data?.categories) setCategories(data.data.categories);
            } catch (e) { }
        };
        fetchCategories();

        const savedCart = localStorage.getItem('seaura_cart');
        const savedWishlist = localStorage.getItem('seaura_wishlist');
        if (savedCart) setCart(JSON.parse(savedCart));
        if (savedWishlist) setWishlist(JSON.parse(savedWishlist));
        setIsLoaded(true);
    }, []);

    const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * (item.quantity || 1)), 0);
    const shipping = 8.0;
    const total = subtotal + shipping;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as any;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setIsSubmitting(true);
        try {
            const items = cart.map(item => ({
                id: item.id,
                name: item.name,
                price: parseFloat(item.price),
                selectedSize: item.selectedSize || "Standard",
                selectedColor: item.selectedColor || "N/A",
                quantity: item.quantity || 1
            }));

            const res = await fetch('/api/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `mutation($total: Float!, $items: [OrderItemInput!]!, $email: String, $phone: String, $address: String, $city: String) {
                        createOrder(total: $total, items: $items, email: $email, phone: $phone, address: $address, city: $city) { id }
                    }`,
                    variables: {
                        total,
                        items,
                        email: formData.email,
                        phone: formData.phone,
                        address: `${formData.address}${formData.apartment ? ', ' + formData.apartment : ''}`,
                        city: formData.city
                    }
                })
            });

            const data = await res.json();
            if (data.data?.createOrder) {
                await Swal.fire({
                    title: 'MERCI POUR VOTRE CONFIANCE',
                    html: `
                        <div style="padding: 10px;">
                            <p style="font-size: 1.1rem; color: #555; font-style: italic; margin-bottom: 20px;">
                                "L'art de l'élégance commence ici..."
                            </p>
                            <p style="margin-top: 10px; font-weight: 600; color: #000; letter-spacing: 1px; text-transform: uppercase; font-size: 0.9rem;">
                                Votre commande a été enregistrée avec succès.
                            </p>
                        </div>
                    `,
                    icon: 'success',
                    iconColor: '#C5A059',
                    showConfirmButton: false,
                    timer: 5000,
                    timerProgressBar: true,
                    background: '#FDFCF7',
                    backdrop: 'rgba(0,0,0,0.8)',
                    customClass: {
                        popup: 'rounded-[4rem] border-none shadow-[0_50px_100px_rgba(0,0,0,0.3)] p-16',
                        title: 'text-xl font-black tracking-[0.2em] text-black uppercase',
                    }
                });

                setOrderSummary({
                    id: data.data.createOrder.id,
                    date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
                    total,
                    items,
                    billing: { ...formData }
                });
                localStorage.removeItem('seaura_cart');
                setCart([]);
            } else {
                throw new Error("Failed to create order");
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Erreur', text: 'Une erreur est survenue lors de la validation.', confirmButtonColor: '#000' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isLoaded) return null;

    return (
        <div className={styles.checkoutContainer}>
            <Header
                categories={categories}
                cartCount={cart.length}
                wishlistCount={wishlist.length}
                forceBlack={true}
            />

            <main className={styles.checkoutContent}>
                <div className={styles.checkoutHeader}>
                    <h1 className={styles.checkoutTitle}>Checkout</h1>
                    <div className={styles.breadcrumb}>
                        <Link href="/">Accueil</Link>
                        <ChevronRight size={14} />
                        <span>Checkout</span>
                    </div>
                </div>

                {orderSummary ? (
                    <div className={styles.successContainer}>
                        <div className={styles.successMessage}>
                            <p>Merci. Votre commande a été reçue.</p>
                            <div className={styles.orderBrief}>
                                <div>
                                    <label>Numéro de commande:</label>
                                    <span>{orderSummary.id}</span>
                                </div>
                                <div>
                                    <label>Date:</label>
                                    <span>{orderSummary.date}</span>
                                </div>
                                <div>
                                    <label>Total:</label>
                                    <span>{orderSummary.total.toFixed(2)} TND</span>
                                </div>
                                <div>
                                    <label>Méthode de paiement:</label>
                                    <span>Paiement à la livraison</span>
                                </div>
                            </div>
                            <p className={styles.paymentNote}>Payer en argent comptant à la livraison.</p>

                            <div className={styles.addressGrid}>
                                <div className={styles.addressBox}>
                                    <h3>Adresse de facturation</h3>
                                    <p>{orderSummary.billing.firstName} {orderSummary.billing.lastName}</p>
                                    <p>{orderSummary.billing.address}</p>
                                    <p>{orderSummary.billing.city}</p>
                                    <p>{orderSummary.billing.region}</p>
                                    <p>{orderSummary.billing.zipCode}</p>
                                    <p>{orderSummary.billing.phone}</p>
                                    <p style={{ marginTop: '20px' }}>{orderSummary.billing.email}</p>
                                </div>
                                <div className={styles.addressBox}>
                                    <h3>Adresse de livraison</h3>
                                    <p>{orderSummary.billing.firstName} {orderSummary.billing.lastName}</p>
                                    <p>{orderSummary.billing.address}</p>
                                    <p>{orderSummary.billing.city}</p>
                                    <p>{orderSummary.billing.region}</p>
                                    <p>{orderSummary.billing.zipCode}</p>
                                </div>
                            </div>
                        </div>

                        <div className={styles.orderDetailsTable}>
                            <h3>Order details</h3>
                            <table className={styles.detailsTable}>
                                <thead>
                                    <tr>
                                        <th>Produit</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orderSummary.items.map((item: any, idx: number) => (
                                        <tr key={idx}>
                                            <td>
                                                {item.name} × {item.quantity || 1}
                                                <div className={styles.tableMeta}>• taille: {item.selectedSize}</div>
                                            </td>
                                            <td>{(item.price * (item.quantity || 1)).toFixed(2)} TND</td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td>Sous-total :</td>
                                        <td>{(orderSummary.total - 8).toFixed(2)} TND</td>
                                    </tr>
                                    <tr>
                                        <td>Expédition :</td>
                                        <td>8,00 TND via Forfait</td>
                                    </tr>
                                    <tr>
                                        <td>Total :</td>
                                        <td>{orderSummary.total.toFixed(2)} TND</td>
                                    </tr>
                                    <tr>
                                        <td>Moyen de paiement :</td>
                                        <td>Paiement à la livraison</td>
                                    </tr>
                                    <tr>
                                        <td>Téléphone d'urgence:</td>
                                        <td>{orderSummary.billing.emergencyPhone}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className={styles.checkoutGrid}>
                        {/* LEFT: BILLING DETAILS */}
                        <div className={styles.billingSection}>
                            <h2>Détails de facturation</h2>

                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Prénom *</label>
                                    <input type="text" name="firstName" required value={formData.firstName} onChange={handleInputChange} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Nom *</label>
                                    <input type="text" name="lastName" required value={formData.lastName} onChange={handleInputChange} />
                                </div>

                                <div className={styles.formGroupFull}>
                                    <div className={styles.formGroup}>
                                        <label>Pays/région *</label>
                                        <select name="country" value={formData.country} onChange={handleInputChange}>
                                            <option value="Tunisie">Tunisie</option>
                                            <option value="France">France</option>
                                            <option value="Maroc">Maroc</option>
                                        </select>
                                    </div>
                                </div>

                                <div className={styles.formGroupFull}>
                                    <div className={styles.formGroup}>
                                        <label>Numéro et nom de rue *</label>
                                        <input type="text" name="address" placeholder="Numéro de voie et nom de la rue" required value={formData.address} onChange={handleInputChange} />
                                    </div>
                                </div>

                                <div className={styles.formGroupFull}>
                                    <div className={styles.formGroup}>
                                        <label>Ville *</label>
                                        <input type="text" name="city" required value={formData.city} onChange={handleInputChange} />
                                    </div>
                                </div>

                                <div className={styles.formGroupFull}>
                                    <div className={styles.formGroup}>
                                        <label>Région / Département *</label>
                                        <input type="text" name="region" required value={formData.region} onChange={handleInputChange} />
                                    </div>
                                </div>

                                <div className={styles.formGroupFull}>
                                    <div className={styles.formGroup}>
                                        <label>Code postal *</label>
                                        <input type="text" name="zipCode" required value={formData.zipCode} onChange={handleInputChange} />
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Téléphone *</label>
                                    <input type="tel" name="phone" required value={formData.phone} onChange={handleInputChange} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>E-mail *</label>
                                    <input type="email" name="email" required value={formData.email} onChange={handleInputChange} />
                                </div>

                                <div className={styles.formGroupFull}>
                                    <div className={styles.formGroup}>
                                        <label>Téléphone d'urgence *</label>
                                        <input type="tel" name="emergencyPhone" required value={formData.emergencyPhone} onChange={handleInputChange} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: ORDER SUMMARY */}
                        <div className={styles.summarySection}>
                            <h2>Résumé de la commande</h2>

                            <div className={styles.summaryCard}>
                                {cart.map((item, idx) => (
                                    <div key={idx} className={styles.orderItem}>
                                        <div className={styles.itemImage}>
                                            <Image
                                                src={(item.images && item.images.length > 0) ? item.images[0] : (item.image_url || "/placeholder.png")}
                                                alt={item.name}
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                        <div className={styles.itemInfo}>
                                            <div className={styles.itemName}>{item.name} × {item.quantity || 1}</div>
                                            <div className={styles.itemMeta}>taille: {item.selectedSize}</div>
                                        </div>
                                        <div className={styles.itemPrice}>{(parseFloat(item.price) * (item.quantity || 1)).toFixed(2)} TND</div>
                                    </div>
                                ))}



                                <div className={styles.totals}>
                                    <div className={styles.totalRow}>
                                        <span>Sous-total</span>
                                        <span>{subtotal.toFixed(2)} TND</span>
                                    </div>
                                    <div className={styles.totalRow}>
                                        <span>Expédition</span>
                                        <span>Forfait: {shipping.toFixed(2)} TND</span>
                                    </div>
                                    <div className={`${styles.totalRow} ${styles.grandTotal}`}>
                                        <span>Total</span>
                                        <span>{total.toFixed(2)} TND</span>
                                    </div>
                                </div>

                                <div className={styles.paymentSection}>
                                    <h3>Les informations de paiement</h3>

                                    <div
                                        className={`${styles.paymentBox} ${paymentAccepted ? styles.paymentBoxActive : ""}`}
                                        onClick={() => setPaymentAccepted(!paymentAccepted)}
                                    >
                                        <div className={styles.radioOuter}>
                                            {paymentAccepted && <div className={styles.radioInner} />}
                                        </div>
                                        <span className={styles.paymentLabel}>Paiement à la livraison</span>
                                    </div>

                                    <p className={styles.paymentDesc}>Payer en argent comptant à la livraison.</p>

                                    <p className={styles.policyText}>
                                        Vos données personnelles seront utilisées pour le traitement de votre commande, vous accompagner au cours de votre visite du site web, et pour d'autres raisons décrites dans notre politique de confidentialité.
                                    </p>

                                    <button type="submit" className={styles.commanderBtn} disabled={isSubmitting || cart.length === 0 || !paymentAccepted}>
                                        {isSubmitting ? "TRAITEMENT..." : "COMMANDER"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                )}
            </main>
            <Footer />
        </div>
    );
}
