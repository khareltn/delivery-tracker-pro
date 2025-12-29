// components/InvoicePrinting.jsx
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const InvoicePrinting = ({ company, currentUser, customers, products, formatCurrency, formatDate }) => {
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [invoiceData, setInvoiceData] = useState({
    customerId: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    items: [],
    subtotal: 0,
    taxAmount: 0,
    discount: 0,
    grandTotal: 0,
    notes: '',
    terms: 'Payment due within 30 days',
    status: 'draft'
  });
  const [selectedProduct, setSelectedProduct] = useState({
    productId: '',
    quantity: 1,
    unitPrice: 0
  });
  const [language, setLanguage] = useState('both'); // 'both', 'jp', 'en'
  const invoiceRef = useRef();

  useEffect(() => {
    loadSales();
    generateInvoiceNumber();
  }, [company]);

  const loadSales = async () => {
    if (!company?.id) return;
    try {
      const salesQuery = query(
        collection(db, 'sales'),
        where('companyId', '==', company.id)
      );
      const snapshot = await getDocs(salesQuery);
      const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
      setSales(salesData);
    } catch (error) {
      console.error('Error loading sales:', error);
    }
  };

  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const invoiceNumber = `INV-${year}${month}${day}-${random}`;
    setInvoiceData(prev => ({
      ...prev,
      invoiceNumber,
      invoiceDate: date.toISOString().split('T')[0],
      dueDate: new Date(date.setDate(date.getDate() + 30)).toISOString().split('T')[0]
    }));
  };

  const handleAddItem = () => {
    if (!selectedProduct.productId) {
      toast.error('Please select a product');
      return;
    }
    const product = products.find(p => p.id === selectedProduct.productId);
    if (!product) return;

    const item = {
      productId: product.id,
      productName: product.name,
      productCode: product.sku || 'N/A',
      quantity: parseFloat(selectedProduct.quantity),
      unit: product.unit || 'pc',
      unitPrice: parseFloat(product.sellPrice || 0),
      total: parseFloat(selectedProduct.quantity) * parseFloat(product.sellPrice || 0),
      taxRate: product.taxRate || 8
    };

    const newItems = [...invoiceData.items, item];
    const subtotal = newItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = newItems.reduce((sum, item) => sum + (item.total * item.taxRate / 100), 0);
    const grandTotal = subtotal + taxAmount - invoiceData.discount;

    setInvoiceData({
      ...invoiceData,
      items: newItems,
      subtotal,
      taxAmount,
      grandTotal
    });

    setSelectedProduct({ productId: '', quantity: 1, unitPrice: 0 });
  };

  const handleRemoveItem = (index) => {
    const newItems = invoiceData.items.filter((_, i) => i !== index);
    const subtotal = newItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = newItems.reduce((sum, item) => sum + (item.total * item.taxRate / 100), 0);
    const grandTotal = subtotal + taxAmount - invoiceData.discount;

    setInvoiceData({
      ...invoiceData,
      items: newItems,
      subtotal,
      taxAmount,
      grandTotal
    });
  };

  const handleSaveInvoice = async () => {
    if (!invoiceData.customerId || invoiceData.items.length === 0) {
      toast.error('Please select customer and add items');
      return;
    }

    setLoading(true);
    try {
      const customer = customers.find(c => c.id === invoiceData.customerId);
      const saleData = {
        ...invoiceData,
        companyId: company.id,
        companyName: company.name,
        customerName: customer?.name || 'Unknown',
        customerAddress: customer?.address || '',
        customerMobile: customer?.mobileNumber || '',
        createdBy: currentUser?.email,
        createdById: currentUser?.uid,
        createdAt: new Date(),
        status: 'pending',
        paymentStatus: 'unpaid'
      };

      await addDoc(collection(db, 'sales'), saleData);
      toast.success('✅ Invoice saved successfully!');
      
      // Reset form
      setInvoiceData({
        customerId: '',
        invoiceNumber: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        items: [],
        subtotal: 0,
        taxAmount: 0,
        discount: 0,
        grandTotal: 0,
        notes: '',
        terms: 'Payment due within 30 days',
        status: 'draft'
      });
      generateInvoiceNumber();
      loadSales();
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Failed to save invoice');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;
    
    setLoading(true);
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`invoice-${invoiceData.invoiceNumber}.pdf`);
      
      toast.success('✅ PDF downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setLoading(false);
    }
  };

  const loadSaleDetails = (saleId) => {
    const sale = sales.find(s => s.id === saleId);
    if (sale) {
      setSelectedSale(sale);
      setInvoiceData({
        ...sale,
        dueDate: sale.dueDate || new Date(new Date(sale.invoiceDate).setDate(new Date(sale.invoiceDate).getDate() + 30)).toISOString().split('T')[0]
      });
    }
  };

  const styles = {
    container: {
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
    },
    header: {
      marginBottom: '25px',
      borderBottom: '2px solid #334155',
      paddingBottom: '15px'
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#e2e8f0',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    languageSelector: {
      display: 'flex',
      gap: '10px',
      marginBottom: '20px'
    },
    languageButton: {
      padding: '8px 16px',
      backgroundColor: '#334155',
      color: '#cbd5e1',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      '&:hover': {
        backgroundColor: '#475569'
      }
    },
    languageButtonActive: {
      backgroundColor: '#3b82f6',
      color: 'white'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '20px',
      marginBottom: '25px'
    },
    card: {
      backgroundColor: '#0f172a',
      borderRadius: '10px',
      padding: '20px',
      border: '1px solid #334155'
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#e2e8f0',
      marginBottom: '15px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    label: {
      color: '#cbd5e1',
      fontSize: '14px',
      marginBottom: '8px',
      display: 'block'
    },
    input: {
      width: '100%',
      padding: '10px',
      backgroundColor: '#1e293b',
      border: '1px solid #475569',
      borderRadius: '6px',
      color: '#e2e8f0',
      fontSize: '14px'
    },
    select: {
      width: '100%',
      padding: '10px',
      backgroundColor: '#1e293b',
      border: '1px solid #475569',
      borderRadius: '6px',
      color: '#e2e8f0',
      fontSize: '14px',
      cursor: 'pointer'
    },
    button: {
      padding: '10px 20px',
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      '&:hover': {
        backgroundColor: '#2563eb'
      }
    },
    invoicePreview: {
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '30px',
      marginTop: '25px',
      color: '#000',
      maxWidth: '800px',
      margin: '25px auto'
    }
  };

  // Invoice Preview Component
  const InvoicePreview = () => {
    const customer = customers.find(c => c.id === invoiceData.customerId);
    
    return (
      <div ref={invoiceRef} style={styles.invoicePreview}>
        {/* Company Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e293b', marginBottom: '10px' }}>
            {language === 'jp' ? '請求書' : language === 'en' ? 'INVOICE' : '請求書 / INVOICE'}
          </h1>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {company.name} • {company.address || 'Address not specified'}
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
            📞 {company.phone || 'Phone not specified'} • ✉️ {company.email || 'Email not specified'}
          </div>
        </div>

        {/* Invoice Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px', color: '#333' }}>
              {language === 'jp' ? '顧客情報' : language === 'en' ? 'BILL TO' : '顧客情報 / BILL TO'}
            </h3>
            {customer ? (
              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                <div><strong>{customer.name}</strong></div>
                <div>{customer.address || 'Address not specified'}</div>
                <div>📞 {customer.mobileNumber || customer.landlineNumber || 'Phone not specified'}</div>
                {customer.email && <div>✉️ {customer.email}</div>}
                {customer.taxNumber && <div>🧾 {language === 'jp' ? '税番号' : 'Tax No.'}: {customer.taxNumber}</div>}
              </div>
            ) : (
              <div style={{ color: '#999', fontStyle: 'italic' }}>
                {language === 'jp' ? '顧客が選択されていません' : 'No customer selected'}
              </div>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px', color: '#333' }}>
              {language === 'jp' ? '請求書詳細' : language === 'en' ? 'INVOICE DETAILS' : '請求書詳細 / INVOICE DETAILS'}
            </h3>
            <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
              <div><strong>{language === 'jp' ? '請求書番号' : 'Invoice No.'}:</strong> {invoiceData.invoiceNumber}</div>
              <div><strong>{language === 'jp' ? '発行日' : 'Date'}:</strong> {new Date(invoiceData.invoiceDate).toLocaleDateString('ja-JP')}</div>
              <div><strong>{language === 'jp' ? '支払期限' : 'Due Date'}:</strong> {new Date(invoiceData.dueDate).toLocaleDateString('ja-JP')}</div>
              <div><strong>{language === 'jp' ? 'ステータス' : 'Status'}:</strong> {invoiceData.status}</div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#333', borderBottom: '2px solid #333' }}>
                {language === 'jp' ? '商品名' : language === 'en' ? 'Description' : '商品名 / Description'}
              </th>
              <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#333', borderBottom: '2px solid #333' }}>
                {language === 'jp' ? '数量' : language === 'en' ? 'Qty' : '数量 / Qty'}
              </th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#333', borderBottom: '2px solid #333' }}>
                {language === 'jp' ? '単価' : language === 'en' ? 'Unit Price' : '単価 / Unit Price'}
              </th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#333', borderBottom: '2px solid #333' }}>
                {language === 'jp' ? '金額' : language === 'en' ? 'Amount' : '金額 / Amount'}
              </th>
            </tr>
          </thead>
          <tbody>
            {invoiceData.items.map((item, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px' }}>
                  <div><strong>{item.productName}</strong></div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {item.productCode} • {language === 'jp' ? '税率' : 'Tax'}: {item.taxRate}%
                  </div>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {item.quantity} {item.unit}
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  {formatCurrency(item.unitPrice)}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                  {formatCurrency(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
          <div style={{ width: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>{language === 'jp' ? '小計' : 'Subtotal'}:</span>
              <span>{formatCurrency(invoiceData.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>{language === 'jp' ? '税金' : 'Tax'}:</span>
              <span>{formatCurrency(invoiceData.taxAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>{language === 'jp' ? '割引' : 'Discount'}:</span>
              <span>-{formatCurrency(invoiceData.discount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '2px solid #333', marginTop: '10px', fontSize: '18px', fontWeight: 'bold' }}>
              <span>{language === 'jp' ? '合計金額' : 'Total Amount'}:</span>
              <span style={{ color: '#10b981' }}>{formatCurrency(invoiceData.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Terms and Notes */}
        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px dashed #ccc' }}>
          {invoiceData.notes && (
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '5px', color: '#333' }}>
                {language === 'jp' ? '備考' : 'Notes'}
              </h4>
              <div style={{ fontSize: '13px', color: '#666' }}>{invoiceData.notes}</div>
            </div>
          )}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '5px', color: '#333' }}>
              {language === 'jp' ? '支払い条件' : 'Payment Terms'}
            </h4>
            <div style={{ fontSize: '13px', color: '#666' }}>{invoiceData.terms}</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '12px', color: '#999', borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <div>{company.name} - {language === 'jp' ? '感謝しております。ご不明な点がございましたらお問い合わせください。' : 'Thank you for your business. Please contact us with any questions.'}</div>
          <div style={{ marginTop: '5px' }}>{language === 'jp' ? 'この請求書はコンピューターで生成されました。' : 'This invoice was computer generated.'}</div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span style={{color: '#ef4444'}}>🧾</span>
          請求書発行 / Invoice Printing
        </h2>
      </div>

      {/* Language Selector */}
      <div style={styles.languageSelector}>
        <button
          style={{
            ...styles.languageButton,
            ...(language === 'both' ? styles.languageButtonActive : {})
          }}
          onClick={() => setLanguage('both')}
        >
          🇯🇵🇺🇸 両方 / Both
        </button>
        <button
          style={{
            ...styles.languageButton,
            ...(language === 'jp' ? styles.languageButtonActive : {})
          }}
          onClick={() => setLanguage('jp')}
        >
          🇯🇵 日本語 / Japanese
        </button>
        <button
          style={{
            ...styles.languageButton,
            ...(language === 'en' ? styles.languageButtonActive : {})
          }}
          onClick={() => setLanguage('en')}
        >
          🇺🇸 英語 / English
        </button>
      </div>

      <div style={styles.formGrid}>
        {/* Invoice Form */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>
            <span>📝</span>
            請求書作成 / Create Invoice
          </h3>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={styles.label}>顧客 / Customer *</label>
            <select 
              value={invoiceData.customerId}
              onChange={(e) => setInvoiceData({...invoiceData, customerId: e.target.value})}
              style={styles.select}
              required
            >
              <option value="">顧客を選択 / Select Customer</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} • {customer.mobileNumber || customer.landlineNumber}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={styles.label}>請求書番号 / Invoice #</label>
              <input
                type="text"
                value={invoiceData.invoiceNumber}
                onChange={(e) => setInvoiceData({...invoiceData, invoiceNumber: e.target.value})}
                style={styles.input}
                required
              />
            </div>
            <div>
              <label style={styles.label}>発行日 / Invoice Date</label>
              <input
                type="date"
                value={invoiceData.invoiceDate}
                onChange={(e) => setInvoiceData({...invoiceData, invoiceDate: e.target.value})}
                style={styles.input}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={styles.label}>製品を追加 / Add Product</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <select 
                value={selectedProduct.productId}
                onChange={(e) => {
                  const product = products.find(p => p.id === e.target.value);
                  setSelectedProduct({
                    ...selectedProduct,
                    productId: e.target.value,
                    unitPrice: product ? product.sellPrice : 0
                  });
                }}
                style={{...styles.select, flex: 2}}
              >
                <option value="">製品を選択 / Select Product</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} • {formatCurrency(product.sellPrice)}
                  </option>
                ))}
              </select>
              <input 
                type="number" 
                min="1"
                value={selectedProduct.quantity}
                onChange={(e) => setSelectedProduct({...selectedProduct, quantity: e.target.value})}
                style={{...styles.input, flex: 1}}
                placeholder="数量 / Qty"
              />
              <button 
                type="button" 
                style={styles.button}
                onClick={handleAddItem}
              >
                ➕ 追加 / Add
              </button>
            </div>
          </div>

          {/* Items List */}
          {invoiceData.items.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={styles.label}>請求品目 / Invoice Items</h4>
              <div style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: '#1e293b', borderRadius: '6px', padding: '10px' }}>
                {invoiceData.items.map((item, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px',
                    borderBottom: '1px solid #334155',
                    '&:last-child': { borderBottom: 'none' }
                  }}>
                    <div style={{ flex: 2 }}>
                      <div style={{ color: '#e2e8f0', fontSize: '14px' }}>{item.productName}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <span style={{ color: '#10b981', fontWeight: '600' }}>
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                    <button 
                      type="button"
                      style={{...styles.button, padding: '6px 12px', backgroundColor: '#dc2626', marginLeft: '10px'}}
                      onClick={() => handleRemoveItem(index)}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button 
              style={{...styles.button, flex: 1}}
              onClick={handleSaveInvoice}
              disabled={loading}
            >
              💾 請求書を保存
            </button>
            <button 
              style={{...styles.button, flex: 1, backgroundColor: '#10b981'}}
              onClick={handlePrintInvoice}
              disabled={!invoiceData.customerId || invoiceData.items.length === 0}
            >
              🖨️ 印刷 / Print
            </button>
            <button 
              style={{...styles.button, flex: 1, backgroundColor: '#8b5cf6'}}
              onClick={handleDownloadPDF}
              disabled={!invoiceData.customerId || invoiceData.items.length === 0}
            >
              📄 PDFをダウンロード
            </button>
          </div>
        </div>

        {/* Recent Invoices */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>
            <span>📋</span>
            最近の請求書 / Recent Invoices
          </h3>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {sales.slice(0, 10).map(sale => (
              <div 
                key={sale.id} 
                style={{
                  padding: '15px',
                  borderBottom: '1px solid #334155',
                  backgroundColor: '#1e293b',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: '#334155'
                  }
                }}
                onClick={() => loadSaleDetails(sale.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ color: '#e2e8f0' }}>{sale.invoiceNumber}</strong>
                  <span style={{
                    backgroundColor: sale.paymentStatus === 'paid' ? '#10b981' : '#f59e0b',
                    color: sale.paymentStatus === 'paid' ? 'white' : 'black',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {sale.paymentStatus}
                  </span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ color: '#cbd5e1', fontSize: '14px' }}>{sale.customerName}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {new Date(sale.invoiceDate).toLocaleDateString('ja-JP')}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#cbd5e1' }}>{sale.items?.length || 0} 品目</span>
                  <strong style={{ color: '#10b981' }}>{formatCurrency(sale.grandTotal)}</strong>
                </div>
              </div>
            ))}
            {sales.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                請求書はありません
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Preview */}
      {invoiceData.customerId && invoiceData.items.length > 0 && (
        <div>
          <h3 style={styles.sectionTitle}>
            <span>👁️</span>
            請求書プレビュー / Invoice Preview
          </h3>
          <InvoicePreview />
        </div>
      )}
    </div>
  );
};

export default InvoicePrinting;