// components/DeliveryInvoice.jsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const DeliveryInvoice = ({ company, currentUser, drivers, onCreateDelivery, logActivity }) => {
  const [selectedDriver, setSelectedDriver] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Generate invoice number (Bilingual format)
  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${year}${month}${day}-${random}`;
  };

  // Load customers and products
  useEffect(() => {
    if (!company?.id) return;

    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load customers
        const customersQuery = query(
          collection(db, 'users'),
          where('companyId', '==', company.id),
          where('role', '==', 'customer')
        );
        const customersSnapshot = await getDocs(customersQuery);
        const customersData = customersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCustomers(customersData);

        // Load products
        const productsQuery = query(
          collection(db, 'products'),
          where('companyId', '==', company.id)
        );
        const productsSnapshot = await getDocs(productsQuery);
        const productsData = productsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(productsData);

        // Generate invoice number
        setInvoiceNumber(generateInvoiceNumber());
        
        // Set delivery date to today
        const today = new Date().toISOString().split('T')[0];
        setDeliveryDate(today);

      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load data / データの読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [company]);

  // Add product to cart
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([
        ...cart,
        {
          ...product,
          quantity: 1,
          unitPrice: product.price || 0,
          amount: product.price || 0,
          remarks: ''
        }
      ]);
    }
    toast.success(`Added ${product.name} to cart / ${product.name} をカートに追加しました`);
  };

  // Update cart item
  const updateCartItem = (id, field, value) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Recalculate amount if quantity or unit price changes
        if (field === 'quantity' || field === 'unitPrice') {
          const quantity = field === 'quantity' ? value : item.quantity;
          const unitPrice = field === 'unitPrice' ? parseFloat(value) || 0 : item.unitPrice;
          updatedItem.amount = (quantity * unitPrice).toFixed(0); // Yen doesn't use decimals
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  // Remove from cart
  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
    toast.success('Item removed from cart / カートから商品を削除しました');
  };

  // Calculate totals (Japanese consumption tax: 10% standard, 8% reduced)
  const calculateTotals = () => {
    let subtotal = 0;
    let tax8 = 0;
    let tax10 = 0;
    let totalTax = 0;
    let grandTotal = 0;

    cart.forEach(item => {
      const amount = parseFloat(item.amount) || 0;
      subtotal += amount;
      
      // Apply 8% reduced tax to food items, 10% standard to others
      const isFoodItem = item.category === 'food' || item.category === 'beverage';
      if (isFoodItem) {
        tax8 += amount * 0.08;
      } else {
        tax10 += amount * 0.10;
      }
    });

    totalTax = tax8 + tax10;
    grandTotal = subtotal + totalTax;

    return {
      subtotal: Math.round(subtotal),
      tax8: Math.round(tax8),
      tax10: Math.round(tax10),
      totalTax: Math.round(totalTax),
      grandTotal: Math.round(grandTotal)
    };
  };

  // Create delivery and invoice
  const handleCreateInvoice = async () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer / 顧客を選択してください');
      return;
    }

    if (!selectedDriver) {
      toast.error('Please select a driver / ドライバーを選択してください');
      return;
    }

    if (cart.length === 0) {
      toast.error('Please add products to cart / 商品をカートに追加してください');
      return;
    }

    try {
      setLoading(true);
      const totals = calculateTotals();
      
      // Create delivery record
      const deliveryData = {
        companyId: company.id,
        companyName: company.name,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerAddress: selectedCustomer.address || '',
        customerPhone: selectedCustomer.mobileNumber || selectedCustomer.landlineNumber,
        driverId: selectedDriver,
        driverName: drivers.find(d => d.id === selectedDriver)?.name || '',
        invoiceNumber: invoiceNumber,
        deliveryDate: new Date(deliveryDate),
        products: cart.map(item => ({
          productId: item.id,
          productName: item.name,
          productCode: item.code,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          amount: item.amount,
          remarks: item.remarks
        })),
        totals: totals,
        paymentMethod: paymentMethod,
        paymentStatus: paymentMethod === 'cash' ? 'pending' : 'paid',
        notes: notes,
        status: 'pending',
        createdAt: new Date(),
        createdBy: currentUser.email,
        createdById: currentUser.uid,
        currency: 'JPY'
      };

      // Save to Firestore
      const deliveryRef = await addDoc(collection(db, 'deliveries'), deliveryData);
      
      // Create invoice record
      const invoiceData = {
        ...deliveryData,
        deliveryId: deliveryRef.id,
        type: 'invoice',
        generatedAt: new Date()
      };
      
      await addDoc(collection(db, 'invoices'), invoiceData);

      // Log activity
      await logActivity('INVOICE_CREATED', 'invoice', {
        invoiceNumber: invoiceNumber,
        customerName: selectedCustomer.name,
        totalAmount: totals.grandTotal,
        deliveryId: deliveryRef.id,
        currency: 'JPY'
      });

      toast.success('✅ Invoice created successfully! / 納品書を作成しました！');
      
      // Reset form
      setCart([]);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setInvoiceNumber(generateInvoiceNumber());
      setNotes('');
      
      // Show preview
      setShowPreview(true);

    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Failed to create invoice / 納品書の作成に失敗しました: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate PDF
  const generatePDF = async () => {
    const input = document.getElementById('invoice-preview');
    const canvas = await html2canvas(input, {
      scale: 2,
      useCORS: true,
      logging: false
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`delivery-invoice-${invoiceNumber}.pdf`);
  };

  // Print invoice
  const printInvoice = () => {
    const printContent = document.getElementById('invoice-preview').innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    return `¥ ${amount.toLocaleString('ja-JP')}`;
  };

  // Render invoice preview
  const InvoicePreview = () => {
    const totals = calculateTotals();
    const paymentMethodLabels = {
      'cash': 'Cash / 現金',
      'credit_card': 'Credit Card / クレジットカード',
      'bank_transfer': 'Bank Transfer / 銀行振込',
      'konbini': 'Konbini Payment / コンビニ払い'
    };
    
    return (
      <div id="invoice-preview" style={invoiceStyles.previewContainer}>
        {/* Company Header */}
        <div style={invoiceStyles.companyHeader}>
          <div style={invoiceStyles.companyInfo}>
            <h2 style={invoiceStyles.companyName}>{company?.name || 'Company Name / 会社名'}</h2>
            <p style={invoiceStyles.companyAddress}>
              {company?.address || 'Company Address / 会社住所'} • 
              Phone / 電話: {company?.phone || 'Phone Number / 電話番号'}
            </p>
            <p style={invoiceStyles.companyGST}>
              Registration No / 登録番号: {company?.registrationNumber || 'Not Available / 登録されていません'}
            </p>
            <p style={invoiceStyles.companyTax}>
              Tax Registration / 消費税登録番号: {company?.taxNumber || company?.registrationNumber || 'Not Available / 登録されていません'}
            </p>
          </div>
          <div style={invoiceStyles.invoiceHeader}>
            <h3 style={invoiceStyles.invoiceTitle}>DELIVERY SLIP & INVOICE / 納品書兼請求書</h3>
            <p style={invoiceStyles.invoiceNumber}>Invoice No / 伝票番号: {invoiceNumber}</p>
            <p style={invoiceStyles.invoiceDate}>
              Date / 発行日: {new Date(deliveryDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short'
              })} ({new Date(deliveryDate).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short'
              })})
            </p>
          </div>
        </div>

        {/* Customer & Delivery Info */}
        <div style={invoiceStyles.infoSection}>
          <div style={invoiceStyles.billTo}>
            <h4 style={invoiceStyles.infoTitle}>Bill To / お届け先:</h4>
            <p style={invoiceStyles.infoContent}>
              <strong>{selectedCustomer?.name || 'Customer Name / 顧客名'}</strong><br/>
              {selectedCustomer?.address || 'Customer Address / 顧客住所'}<br/>
              Phone / 電話: {selectedCustomer?.mobileNumber || selectedCustomer?.landlineNumber || 'N/A'}<br/>
              Customer ID / 顧客ID: {selectedCustomer?.id?.substring(0, 8) || 'N/A'}
            </p>
          </div>
          
          <div style={invoiceStyles.deliveryInfo}>
            <h4 style={invoiceStyles.infoTitle}>Delivery Details / 配送詳細:</h4>
            <p style={invoiceStyles.infoContent}>
              <strong>Delivery Date / 配送日:</strong> {new Date(deliveryDate).toLocaleDateString('en-US')} ({new Date(deliveryDate).toLocaleDateString('ja-JP')})<br/>
              <strong>Driver / ドライバー:</strong> {drivers.find(d => d.id === selectedDriver)?.name || 'Not Assigned / 未割当'}<br/>
              <strong>Payment Method / 支払方法:</strong> {paymentMethodLabels[paymentMethod] || paymentMethod}
            </p>
          </div>
        </div>

        {/* Products Table */}
        <div style={invoiceStyles.tableSection}>
          <table style={invoiceStyles.table}>
            <thead>
              <tr style={invoiceStyles.tableHeader}>
                <th style={invoiceStyles.tableCell}>No. / 番号</th>
                <th style={invoiceStyles.tableCell}>Product Name & Code / 品名・品番</th>
                <th style={invoiceStyles.tableCell}>Quantity / 数量</th>
                <th style={invoiceStyles.tableCell}>Unit / 単位</th>
                <th style={invoiceStyles.tableCell}>Unit Price (¥) / 単価 (¥)</th>
                <th style={invoiceStyles.tableCell}>Amount (¥) / 金額 (¥)</th>
                <th style={invoiceStyles.tableCell}>Remarks / 備考</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item, index) => (
                <tr key={item.id} style={invoiceStyles.tableRow}>
                  <td style={invoiceStyles.tableCell}>{index + 1}</td>
                  <td style={invoiceStyles.tableCell}>
                    <strong>{item.name}</strong><br/>
                    <small>Code / 品番: {item.code || 'N/A'}</small>
                  </td>
                  <td style={invoiceStyles.tableCell}>{item.quantity}</td>
                  <td style={invoiceStyles.tableCell}>{item.unit || 'Pieces / 個'}</td>
                  <td style={invoiceStyles.tableCell}>{formatCurrency(parseInt(item.unitPrice))}</td>
                  <td style={invoiceStyles.tableCell}>{formatCurrency(parseInt(item.amount))}</td>
                  <td style={invoiceStyles.tableCell}>{item.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div style={invoiceStyles.totalsSection}>
          <div style={invoiceStyles.totalsContainer}>
            <div style={invoiceStyles.totalsRow}>
              <span style={invoiceStyles.totalsLabel}>Subtotal / 小計:</span>
              <span style={invoiceStyles.totalsValue}>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div style={invoiceStyles.totalsRow}>
              <span style={invoiceStyles.totalsLabel}>Tax @8% / 消費税 (8%):</span>
              <span style={invoiceStyles.totalsValue}>{formatCurrency(totals.tax8)}</span>
            </div>
            <div style={invoiceStyles.totalsRow}>
              <span style={invoiceStyles.totalsLabel}>Tax @10% / 消費税 (10%):</span>
              <span style={invoiceStyles.totalsValue}>{formatCurrency(totals.tax10)}</span>
            </div>
            <div style={invoiceStyles.totalsRow}>
              <span style={invoiceStyles.totalsLabel}>Total Tax / 消費税合計:</span>
              <span style={invoiceStyles.totalsValue}>{formatCurrency(totals.totalTax)}</span>
            </div>
            <div style={{...invoiceStyles.totalsRow, ...invoiceStyles.grandTotal}}>
              <span style={invoiceStyles.totalsLabel}>Grand Total / 合計金額:</span>
              <span style={invoiceStyles.totalsValue}>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {notes && (
          <div style={invoiceStyles.notesSection}>
            <h4 style={invoiceStyles.notesTitle}>Notes / 備考:</h4>
            <p style={invoiceStyles.notesContent}>{notes}</p>
          </div>
        )}

        {/* Signatures */}
        <div style={invoiceStyles.signaturesSection}>
          <div style={invoiceStyles.signature}>
            <p style={invoiceStyles.signatureLine}>___________________</p>
            <p style={invoiceStyles.signatureLabel}>Customer Signature / お客様署名</p>
          </div>
          <div style={invoiceStyles.signature}>
            <p style={invoiceStyles.signatureLine}>___________________</p>
            <p style={invoiceStyles.signatureLabel}>Driver Signature / ドライバー署名</p>
          </div>
          <div style={invoiceStyles.signature}>
            <p style={invoiceStyles.signatureLine}>___________________</p>
            <p style={invoiceStyles.signatureLabel}>Company Stamp / 会社印</p>
          </div>
        </div>

        {/* Delivery Slip Section */}
        <div style={invoiceStyles.deliverySlipSection}>
          <h3 style={invoiceStyles.deliverySlipTitle}>DELIVERY SLIP / 納品書</h3>
          <div style={invoiceStyles.deliverySlipContent}>
            <div style={invoiceStyles.deliveryInfoCompact}>
              <p><strong>Invoice No / 伝票番号:</strong> {invoiceNumber}</p>
              <p><strong>Customer / 顧客名:</strong> {selectedCustomer?.name || 'Customer Name / 顧客名'}</p>
              <p><strong>Delivery Date / 配送日:</strong> {new Date(deliveryDate).toLocaleDateString('en-US')} ({new Date(deliveryDate).toLocaleDateString('ja-JP')})</p>
              <p><strong>Driver / ドライバー:</strong> {drivers.find(d => d.id === selectedDriver)?.name || 'Not Assigned / 未割当'}</p>
            </div>
            
            <div style={invoiceStyles.deliveryItems}>
              <table style={invoiceStyles.deliveryTable}>
                <thead>
                  <tr>
                    <th style={invoiceStyles.deliveryTableCell}>Item / 品目</th>
                    <th style={invoiceStyles.deliveryTableCell}>Qty / 数量</th>
                    <th style={invoiceStyles.deliveryTableCell}>Delivered / 納品確認</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, index) => (
                    <tr key={item.id}>
                      <td style={invoiceStyles.deliveryTableCell}>
                        {item.name} ({item.code})
                      </td>
                      <td style={invoiceStyles.deliveryTableCell}>{item.quantity} {item.unit || 'Pcs / 個'}</td>
                      <td style={invoiceStyles.deliveryTableCell}>
                        <span style={invoiceStyles.checkbox}>□</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={invoiceStyles.deliverySignatures}>
              <p style={invoiceStyles.deliverySignatureLine}>
                Customer Acknowledgment / 受領確認: ___________________
              </p>
              <p style={invoiceStyles.deliverySignatureLine}>
                Amount Received / 受領金額: {formatCurrency(totals.grandTotal)} (Cash/Online / 現金/オンライン) _______
              </p>
              <p style={invoiceStyles.deliveryNotes}>
                <small>Note: Please sign after verifying all items received in good condition. / 注: すべての商品が良好な状態で受領されたことを確認の上、署名してください。</small>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={invoiceStyles.container}>
      <div style={invoiceStyles.header}>
        <h2 style={invoiceStyles.title}>📝 Delivery Invoice & Slip / 納品書作成</h2>
        <p style={invoiceStyles.subtitle}>Create invoices and delivery slips for customer orders / 顧客への納品書と請求書を作成します</p>
      </div>

      <div style={invoiceStyles.content}>
        {/* Left Panel - Order Creation */}
        <div style={invoiceStyles.leftPanel}>
          <div style={invoiceStyles.formSection}>
            <h3 style={invoiceStyles.sectionTitle}>Order Details / 注文詳細</h3>
            
            {/* Customer Selection */}
            <div style={invoiceStyles.formGroup}>
              <label style={invoiceStyles.label}>Select Customer / 顧客を選択</label>
              <div style={invoiceStyles.searchContainer}>
                <input
                  type="text"
                  placeholder="Search customer by name or phone... / 顧客名または電話番号で検索..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  style={invoiceStyles.searchInput}
                />
                {customerSearch && (
                  <div style={invoiceStyles.searchResults}>
                    {customers
                      .filter(customer => 
                        customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                        (customer.mobileNumber && customer.mobileNumber.includes(customerSearch)) ||
                        (customer.landlineNumber && customer.landlineNumber.includes(customerSearch))
                      )
                      .slice(0, 5)
                      .map(customer => (
                        <div
                          key={customer.id}
                          style={invoiceStyles.searchResultItem}
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setCustomerSearch(customer.name);
                          }}
                        >
                          {customer.name} - {customer.mobileNumber || customer.landlineNumber}
                        </div>
                      ))}
                  </div>
                )}
              </div>
              {selectedCustomer && (
                <div style={invoiceStyles.selectedCustomer}>
                  <strong>Selected / 選択済み:</strong> {selectedCustomer.name} • 
                  {selectedCustomer.mobileNumber || selectedCustomer.landlineNumber}
                  <button
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearch('');
                    }}
                    style={invoiceStyles.removeButton}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Driver Selection */}
            <div style={invoiceStyles.formGroup}>
              <label style={invoiceStyles.label}>Assign Driver / ドライバーを割当</label>
              <select
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                style={invoiceStyles.select}
              >
                <option value="">Select Driver / ドライバーを選択</option>
                {drivers.map(driver => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name} {driver.isOnline ? '🟢' : '⚫'} - {driver.vehicleNumber || 'No Vehicle / 車両なし'}
                  </option>
                ))}
              </select>
            </div>

            {/* Invoice Details */}
            <div style={invoiceStyles.formRow}>
              <div style={invoiceStyles.formGroup}>
                <label style={invoiceStyles.label}>Invoice Number / 伝票番号</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  style={invoiceStyles.input}
                />
              </div>
              <div style={invoiceStyles.formGroup}>
                <label style={invoiceStyles.label}>Delivery Date / 配送日</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  style={invoiceStyles.input}
                />
              </div>
            </div>

            {/* Payment Method */}
            <div style={invoiceStyles.formGroup}>
              <label style={invoiceStyles.label}>Payment Method / 支払方法</label>
              <div style={invoiceStyles.paymentMethods}>
                {[
                  { value: 'cash', label: 'Cash / 現金' },
                  { value: 'credit_card', label: 'Credit Card / クレジットカード' },
                  { value: 'bank_transfer', label: 'Bank Transfer / 銀行振込' },
                  { value: 'konbini', label: 'Konbini / コンビニ払い' }
                ].map(method => (
                  <button
                    key={method.value}
                    type="button"
                    style={{
                      ...invoiceStyles.paymentMethodButton,
                      ...(paymentMethod === method.value ? invoiceStyles.paymentMethodActive : {})
                    }}
                    onClick={() => setPaymentMethod(method.value)}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={invoiceStyles.formGroup}>
              <label style={invoiceStyles.label}>Notes / 備考</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any special instructions or notes... / 特記事項や注意事項を入力..."
                rows="3"
                style={invoiceStyles.textarea}
              />
            </div>
          </div>

          {/* Products Section */}
          <div style={invoiceStyles.formSection}>
            <h3 style={invoiceStyles.sectionTitle}>Add Products / 商品を追加</h3>
            <div style={invoiceStyles.productsGrid}>
              {products.slice(0, 12).map(product => (
                <div key={product.id} style={invoiceStyles.productCard}>
                  <div style={invoiceStyles.productInfo}>
                    <strong style={invoiceStyles.productName}>{product.name}</strong>
                    <div style={invoiceStyles.productDetails}>
                      <span>Code / 品番: {product.code || 'N/A'}</span>
                      <span>Stock / 在庫: {product.currentStock || 0}</span>
                      <span>Price / 価格: {formatCurrency(parseInt(product.price || 0))}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => addToCart(product)}
                    style={invoiceStyles.addButton}
                    disabled={!product.currentStock || product.currentStock <= 0}
                  >
                    Add to Cart / カートに追加
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Cart */}
        <div style={invoiceStyles.rightPanel}>
          <div style={invoiceStyles.cartSection}>
            <h3 style={invoiceStyles.sectionTitle}>
              Cart Items / カート内の商品 ({cart.length})
            </h3>
            
            {cart.length === 0 ? (
              <div style={invoiceStyles.emptyCart}>
                <div style={invoiceStyles.emptyCartIcon}>🛒</div>
                <p>No items in cart / カートに商品がありません</p>
                <p>Add products from the left panel / 左側のパネルから商品を追加してください</p>
              </div>
            ) : (
              <>
                <div style={invoiceStyles.cartItems}>
                  {cart.map((item, index) => (
                    <div key={item.id} style={invoiceStyles.cartItem}>
                      <div style={invoiceStyles.cartItemHeader}>
                        <strong>{index + 1}. {item.name}</strong>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          style={invoiceStyles.removeItemButton}
                        >
                          ×
                        </button>
                      </div>
                      <div style={invoiceStyles.cartItemDetails}>
                        <div style={invoiceStyles.cartItemField}>
                          <label>Quantity / 数量:</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateCartItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                            style={invoiceStyles.cartInput}
                          />
                        </div>
                        <div style={invoiceStyles.cartItemField}>
                          <label>Unit / 単位:</label>
                          <select
                            value={item.unit || 'Pieces / 個'}
                            onChange={(e) => updateCartItem(item.id, 'unit', e.target.value)}
                            style={invoiceStyles.cartSelect}
                          >
                            <option value="Pieces / 個">Pieces / 個</option>
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="l">l</option>
                            <option value="Box / 箱">Box / 箱</option>
                            <option value="Pack / パック">Pack / パック</option>
                            <option value="Set / セット">Set / セット</option>
                            <option value="Case / ケース">Case / ケース</option>
                          </select>
                        </div>
                        <div style={invoiceStyles.cartItemField}>
                          <label>Unit Price (¥) / 単価 (¥):</label>
                          <input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => updateCartItem(item.id, 'unitPrice', parseInt(e.target.value) || 0)}
                            style={invoiceStyles.cartInput}
                          />
                        </div>
                        <div style={invoiceStyles.cartItemField}>
                          <label>Amount (¥) / 金額 (¥):</label>
                          <input
                            type="text"
                            value={formatCurrency(parseInt(item.amount))}
                            readOnly
                            style={invoiceStyles.cartInput}
                          />
                        </div>
                        <div style={invoiceStyles.cartItemField}>
                          <label>Remarks / 備考:</label>
                          <input
                            type="text"
                            value={item.remarks || ''}
                            onChange={(e) => updateCartItem(item.id, 'remarks', e.target.value)}
                            placeholder="Special instructions... / 特記事項..."
                            style={invoiceStyles.cartInput}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cart Totals */}
                <div style={invoiceStyles.cartTotals}>
                  {(() => {
                    const totals = calculateTotals();
                    return (
                      <>
                        <div style={invoiceStyles.totalRow}>
                          <span>Subtotal / 小計:</span>
                          <span>{formatCurrency(totals.subtotal)}</span>
                        </div>
                        <div style={invoiceStyles.totalRow}>
                          <span>Tax @8% / 消費税 (8%):</span>
                          <span>{formatCurrency(totals.tax8)}</span>
                        </div>
                        <div style={invoiceStyles.totalRow}>
                          <span>Tax @10% / 消費税 (10%):</span>
                          <span>{formatCurrency(totals.tax10)}</span>
                        </div>
                        <div style={invoiceStyles.totalRow}>
                          <span>Total Tax / 消費税合計:</span>
                          <span>{formatCurrency(totals.totalTax)}</span>
                        </div>
                        <div style={invoiceStyles.grandTotalRow}>
                          <span>Grand Total / 合計金額:</span>
                          <span>{formatCurrency(totals.grandTotal)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Action Buttons */}
                <div style={invoiceStyles.cartActions}>
                  <button
                    onClick={handleCreateInvoice}
                    disabled={loading || !selectedCustomer || cart.length === 0}
                    style={invoiceStyles.createButton}
                  >
                    {loading ? 'Creating... / 作成中...' : 'Create Invoice & Delivery / 納品書を作成'}
                  </button>
                  
                  <button
                    onClick={() => setShowPreview(true)}
                    disabled={cart.length === 0}
                    style={invoiceStyles.previewButton}
                  >
                    Preview Invoice / プレビューを見る
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {showPreview && (
        <div style={invoiceStyles.modalOverlay}>
          <div style={invoiceStyles.modal}>
            <div style={invoiceStyles.modalHeader}>
              <h3 style={invoiceStyles.modalTitle}>Invoice Preview / 納品書プレビュー</h3>
              <button
                onClick={() => setShowPreview(false)}
                style={invoiceStyles.closeButton}
              >
                ×
              </button>
            </div>
            
            <div style={invoiceStyles.modalContent}>
              <InvoicePreview />
            </div>
            
            <div style={invoiceStyles.modalActions}>
              <button
                onClick={printInvoice}
                style={invoiceStyles.printButton}
              >
                🖨️ Print Invoice / 印刷する
              </button>
              <button
                onClick={generatePDF}
                style={invoiceStyles.pdfButton}
              >
                📄 Download PDF / PDFをダウンロード
              </button>
              <button
                onClick={() => setShowPreview(false)}
                style={invoiceStyles.cancelButton}
              >
                Close Preview / 閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles for the Invoice component
const invoiceStyles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '25px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  header: {
    marginBottom: '30px'
  },
  title: {
    fontSize: '26px',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '5px'
  },
  subtitle: {
    color: '#64748b',
    fontSize: '15px'
  },
  content: {
    display: 'flex',
    gap: '25px',
    flexWrap: 'wrap'
  },
  leftPanel: {
    flex: '2',
    minWidth: '300px'
  },
  rightPanel: {
    flex: '1',
    minWidth: '350px'
  },
  formSection: {
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '20px',
    border: '1px solid #e2e8f0'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '20px',
    paddingBottom: '10px',
    borderBottom: '2px solid #3b82f6'
  },
  formGroup: {
    marginBottom: '20px'
  },
  formRow: {
    display: 'flex',
    gap: '15px',
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '500',
    color: '#475569',
    fontSize: '14px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: 'white',
    '&:focus': {
      outline: 'none',
      borderColor: '#3b82f6',
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
    }
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: 'white',
    '&:focus': {
      outline: 'none',
      borderColor: '#3b82f6'
    }
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: 'white',
    resize: 'vertical',
    '&:focus': {
      outline: 'none',
      borderColor: '#3b82f6'
    }
  },
  searchContainer: {
    position: 'relative'
  },
  searchInput: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: 'white'
  },
  searchResults: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    zIndex: 1000,
    maxHeight: '200px',
    overflowY: 'auto'
  },
  searchResultItem: {
    padding: '10px 12px',
    cursor: 'pointer',
    fontSize: '14px',
    borderBottom: '1px solid #f1f5f9',
    '&:hover': {
      backgroundColor: '#f1f5f9'
    }
  },
  selectedCustomer: {
    marginTop: '10px',
    padding: '10px',
    backgroundColor: '#dbeafe',
    borderRadius: '6px',
    fontSize: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  removeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ef4444',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    '&:hover': {
      backgroundColor: '#fee2e2'
    }
  },
  paymentMethods: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  paymentMethodButton: {
    padding: '8px 16px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  paymentMethodActive: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#3b82f6'
  },
  productsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '15px'
  },
  productCard: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '15px',
    transition: 'all 0.2s',
    '&:hover': {
      borderColor: '#3b82f6',
      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
    }
  },
  productInfo: {
    marginBottom: '10px'
  },
  productName: {
    display: 'block',
    fontSize: '14px',
    marginBottom: '5px',
    color: '#1e293b'
  },
  productDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontSize: '12px',
    color: '#64748b'
  },
  addButton: {
    width: '100%',
    padding: '8px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#059669'
    },
    '&:disabled': {
      backgroundColor: '#cbd5e1',
      cursor: 'not-allowed'
    }
  },
  cartSection: {
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    padding: '20px',
    border: '1px solid #e2e8f0'
  },
  emptyCart: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#64748b'
  },
  emptyCartIcon: {
    fontSize: '50px',
    marginBottom: '15px',
    opacity: '0.5'
  },
  cartItems: {
    maxHeight: '400px',
    overflowY: 'auto',
    marginBottom: '20px',
    paddingRight: '10px'
  },
  cartItem: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '15px'
  },
  cartItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  removeItemButton: {
    backgroundColor: '#fee2e2',
    color: '#ef4444',
    border: 'none',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&:hover': {
      backgroundColor: '#fecaca'
    }
  },
  cartItemDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '10px'
  },
  cartItemField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  cartInput: {
    padding: '6px 8px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '13px',
    backgroundColor: 'white',
    width: '100%'
  },
  cartSelect: {
    padding: '6px 8px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '13px',
    backgroundColor: 'white',
    width: '100%'
  },
  cartTotals: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '20px'
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px dashed #e2e8f0',
    fontSize: '14px',
    color: '#475569'
  },
  grandTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1e293b',
    borderTop: '2px solid #3b82f6',
    marginTop: '10px'
  },
  cartActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  createButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '600',
    transition: 'background-color 0.2s',
    '&:hover:not(:disabled)': {
      backgroundColor: '#2563eb'
    },
    '&:disabled': {
      backgroundColor: '#cbd5e1',
      cursor: 'not-allowed'
    }
  },
  previewButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#8b5cf6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '600',
    transition: 'background-color 0.2s',
    '&:hover:not(:disabled)': {
      backgroundColor: '#7c3aed'
    },
    '&:disabled': {
      backgroundColor: '#cbd5e1',
      cursor: 'not-allowed'
    }
  },
  // Preview Styles
  previewContainer: {
    backgroundColor: 'white',
    padding: '20mm',
    width: '210mm',
    minHeight: '297mm',
    margin: '0 auto',
    boxSizing: 'border-box',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    fontSize: '12px',
    lineHeight: '1.4',
    color: '#000'
  },
  companyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '2px solid #3b82f6'
  },
  companyInfo: {
    flex: 1
  },
  companyName: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1e293b',
    margin: '0 0 5px 0'
  },
  companyAddress: {
    fontSize: '11px',
    color: '#475569',
    margin: '0 0 5px 0'
  },
  companyGST: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#ef4444',
    margin: '0 0 3px 0'
  },
  companyTax: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#ef4444',
    margin: 0
  },
  invoiceHeader: {
    textAlign: 'right'
  },
  invoiceTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#1e293b',
    margin: '0 0 10px 0'
  },
  invoiceNumber: {
    fontSize: '12px',
    fontWeight: 'bold',
    margin: '0 0 5px 0'
  },
  invoiceDate: {
    fontSize: '12px',
    margin: 0
  },
  infoSection: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px'
  },
  billTo: {
    flex: 1
  },
  deliveryInfo: {
    flex: 1,
    textAlign: 'right'
  },
  infoTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    margin: '0 0 10px 0',
    color: '#1e293b'
  },
  infoContent: {
    fontSize: '12px',
    margin: 0,
    lineHeight: '1.5'
  },
  tableSection: {
    marginBottom: '20px',
    pageBreakInside: 'avoid'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '15px'
  },
  tableHeader: {
    backgroundColor: '#3b82f6',
    color: 'white'
  },
  tableRow: {
    borderBottom: '1px solid #e2e8f0'
  },
  tableCell: {
    padding: '10px',
    border: '1px solid #cbd5e1',
    fontSize: '11px',
    textAlign: 'center'
  },
  totalsSection: {
    marginBottom: '25px',
    pageBreakInside: 'avoid'
  },
  totalsContainer: {
    width: '300px',
    marginLeft: 'auto'
  },
  totalsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '13px'
  },
  grandTotal: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1e293b',
    borderTop: '2px solid #3b82f6',
    borderBottom: 'none',
    marginTop: '10px',
    paddingTop: '12px'
  },
  notesSection: {
    marginBottom: '25px',
    padding: '15px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    borderLeft: '4px solid #3b82f6'
  },
  notesTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    margin: '0 0 10px 0'
  },
  notesContent: {
    fontSize: '12px',
    margin: 0
  },
  signaturesSection: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '50px',
    paddingTop: '20px',
    borderTop: '2px dashed #cbd5e1'
  },
  signature: {
    textAlign: 'center'
  },
  signatureLine: {
    margin: '0 0 10px 0',
    fontSize: '13px'
  },
  signatureLabel: {
    fontSize: '11px',
    color: '#64748b',
    margin: 0
  },
  deliverySlipSection: {
    marginTop: '40px',
    paddingTop: '20px',
    borderTop: '3px double #3b82f6',
    pageBreakBefore: 'always'
  },
  deliverySlipTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    textAlign: 'center',
    margin: '0 0 20px 0',
    color: '#1e293b'
  },
  deliverySlipContent: {
    backgroundColor: '#f8fafc',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1'
  },
  deliveryInfoCompact: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px',
    marginBottom: '20px'
  },
  deliveryItems: {
    marginBottom: '20px'
  },
  deliveryTable: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  deliveryTableCell: {
    padding: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '11px'
  },
  checkbox: {
    fontSize: '16px'
  },
  deliverySignatures: {
    marginTop: '30px'
  },
  deliverySignatureLine: {
    margin: '0 0 15px 0',
    fontSize: '12px'
  },
  deliveryNotes: {
    fontSize: '10px',
    color: '#64748b',
    marginTop: '20px',
    fontStyle: 'italic'
  },
  // Modal Styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '1200px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column'
  },
  modalHeader: {
    padding: '20px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: 0,
    color: '#1e293b'
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '24px',
    color: '#64748b',
    cursor: 'pointer',
    padding: '0',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    '&:hover': {
      backgroundColor: '#f1f5f9'
    }
  },
  modalContent: {
    flex: 1,
    overflow: 'auto',
    padding: '20px'
  },
  modalActions: {
    padding: '20px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end'
  },
  printButton: {
    padding: '10px 20px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#059669'
    }
  },
  pdfButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#2563eb'
    }
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: '#64748b',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: '#f1f5f9'
    }
  }
};

export default DeliveryInvoice;