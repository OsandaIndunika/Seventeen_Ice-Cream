import React, { useState } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaMoneyBillWave } from 'react-icons/fa';
import './CashPayment.css';

function CashPayment() {
  const [cashAmount, setCashAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const billTotal = parseFloat(location.state?.billTotal) || 0;
  const orderItems = location.state?.items || [];

  const handleAmountChange = (e) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setCashAmount(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const numericCash = parseFloat(cashAmount) || 0;

    if (numericCash < billTotal) {
      alert("Cash received cannot be less than the bill total.");
      return;
    }

    const changeDue = (numericCash - billTotal).toFixed(2);

    setIsSubmitting(true);

    const cashBillPayload = {
      invoiceNumber: `INV-${Math.floor(10000 + Math.random() * 90000)}`,
      paymentMethod: 'Cash',
      items: orderItems,
      totalAmount: billTotal.toFixed(2),
      cashReceived: numericCash.toFixed(2),
      changeDue: changeDue,
      timestamp: new Date().toISOString()
    };

    try {
      console.log("Finalizing Cash Bill (Simulated):", cashBillPayload);
      await new Promise(resolve => setTimeout(resolve, 1000));

      alert(`Cash payment recorded successfully! Change due: $${changeDue}`);
      navigate('/billing');
    } catch (error) {
      console.error("Error finalizing cash payment:", error);
      alert("Failed to process payment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="cash-payment-container">
      <header className="payment-header">
        <div className="header-left">
          <button className='back-btn' onClick={() => navigate(-1)}>
            <FaArrowLeft className="back-icon" />
          </button>
          <span className="header-title">Cash Payment</span>
        </div>
        <div className="header-right">
          <span className="bill-label">BILL TOTAL</span>
          <span className="bill-amount">${Number(billTotal).toFixed(2)}</span>
        </div>
      </header>

      <main className="payment-content">
        <div className="payment-card">
          <div className="icon-badge">
            <FaMoneyBillWave className="cash-icon" />
          </div>

          <h2 className="card-title">Enter Cash Received</h2>
          <p className="card-subtitle">
            Collect the physical cash from the shop owner.
          </p>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="payment-form">
            <div className="input-group">
              <label htmlFor="cash-input" className="input-label">
                CASH AMOUNT
              </label>
              <div className="input-wrapper">
                <span className="currency-symbol">$</span>
                <input
                  id="cash-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={cashAmount}
                  onChange={handleAmountChange}
                  className="cash-input"
                />
              </div>
            </div>

            <button type="submit" className="complete-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Processing' : 'Complete Delivery'}
            </button>
          </form>

          <button type="button" className="cancel-btn" onClick={() => navigate(-1)}>
            Cancel & Go Back
          </button>
        </div>
      </main>
    </div>
  );
};

export default CashPayment;