import React, {useState, useEffect} from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import './CreditArrangement.css';
import { FaArrowLeft, FaCreditCard, FaCalendarAlt } from 'react-icons/fa';

function CreditArrangement(props) {
  const location = useLocation();
  const navigate = useNavigate();

  const billTotal = parseFloat(location.state?.billTotal) || 0;
  const orderItems = location.state?.items || [];

  const [cashReceived, setCashReceived] = useState('');
  const [amountCredited, setAmountCredited] = useState(billTotal.toFixed(2));
  const [collectionDate, setCollectionDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setAmountCredited(billTotal.toFixed(2));
  }, [billTotal]);

  const handleCashInputChange = (e) => {
    const inputVal = e.target.value;
    setCashReceived(inputVal);

    const parsedCash = parseFloat(inputVal) || 0;
    if (parsedCash > billTotal) {
        alert("Cash received cannot exceed the total bill amount.");
        setCashReceived(billTotal.toString());
        setAmountCredited('0.00');
        return;
    }

    const remainingCredit = (billTotal - parsedCash).toFixed(2);
    setAmountCredited(remainingCredit);
  };

  const handleAuthorizeCredit = async () => {
    const numericCash = parseFloat(cashReceived) || 0;
    const numericCredit = parseFloat(amountCredited) || 0;

    if (numericCredit > 0 && !collectionDate) {
      alert("Please select a collection date for the remaining credit balance.");
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (numericCredit > 0 && collectionDate < today) {
      alert("Collection date cannot be in the past.");
      return;
    }

    setIsSubmitting(true);

    const creditBillPayload = {
      invoiceNumber: `INV-${Math.floor(10000 + Math.random() * 90000)}`,
      paymentMethod: 'Credit',
      items: orderItems,
      totalAmount: billTotal.toFixed(2),
      cashReceivedNow: numericCash.toFixed(2),
      amountCredited: numericCredit.toFixed(2),
      collectionDate: collectionDate,
      timestamp: new Date().toISOString()
    };

    try {
      console.log("Finalizing Credit Bill (Simulated):", creditBillPayload);
      await new Promise(resolve => setTimeout(resolve, 1000));

      alert(`Credit of $${numericCredit.toFixed(2)} authorized! Collection scheduled for ${collectionDate}.`);
        navigate('/billing'); 
    } catch (error) {
        console.error("Error authorizing credit:", error);
        alert("Failed to process credit arrangement. Please try again.");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="credit-container">
      {/* Header Section */}
      <header className="header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate(-1)}>
            <FaArrowLeft />
          </button>
          <h1 className="header-title">Credit Arrangement</h1>
        </div>
        <div className="header-right">
          <span className="bill-label">BILL TOTAL</span>
          <span className="bill-amount">${billTotal.toFixed(2)}</span>
        </div>
      </header>
      
      <div className="header-divider" />

      {/* Main Content Card */}
      <div className="card-wrapper">
        <div className="modal-card">
          <div className="icon-badge">
            <FaCreditCard className="card-icon" />
          </div>

          <h2 className="modal-title">Split & Schedule Credit</h2>
          <p className="modal-subtitle">Record the partial cash and credit details.</p>

          <form className="credit-form" onSubmit={(e) => e.preventDefault()}>
            {/* Input 1: Cash Received Now */}
            <div className="form-group">
              <label htmlFor="cashReceived" className="form-label">
                CASH RECEIVED NOW
              </label>
              <input
                type="number"
                id="cashReceived"
                value={cashReceived}
                onChange={handleCashInputChange}
                placeholder="0.00"
                className="form-input"
              />
            </div>

            {/* Input 2: Amount Credited */}
            <div className="form-group">
              <label htmlFor="amountCredited" className="form-label">
                AMOUNT CREDITED
              </label>
              <input
                type="text"
                value={`$ ${amountCredited}`}
                className="form-input read-only-input"
                readOnly
              />
            </div>

            {/* Input 3: Collection Date */}
            <div className="form-group">
              <label htmlFor="collectionDate" className="form-label">
                COLLECTION DATE
              </label>
              <div className="date-input-wrapper">
                <input
                  type="date"
                  value={collectionDate}
                  className="form-input date-input"
                  onChange={(e) => setCollectionDate(e.target.value)}
                />
                <FaCalendarAlt className="calendar-icon" />
              </div>
              <span className="helper-text">Set the date to collect the remaining balance.</span>
            </div>

            {/* Action Buttons */}
            <button type="submit" onClick={handleAuthorizeCredit} disabled={isSubmitting} className="authorize-button">
              {isSubmitting ? 'Authorizing...' : 'Authorize Credit'}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="cancel-button">
              Cancel
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreditArrangement;