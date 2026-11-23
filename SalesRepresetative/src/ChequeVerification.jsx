import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { 
  FaArrowLeft, 
  FaFileAlt, 
  FaCamera, 
  FaExclamationCircle 
} from 'react-icons/fa';
import './ChequeVerification.css';

function ChequeVerification() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const billTotal = parseFloat(location.state?.billTotal) || 0;
  const orderItems = location.state?.items || [];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select or capture a cheque image first.');
      return;
    }

    setIsSubmitting(true);

    const chequeBillPayload = {
      invoiceNumber: `INV-${Math.floor(10000 + Math.random() * 90000)}`,
      paymentMethod: 'Cheque',
      items: orderItems,
      totalAmount: billTotal.toFixed(2),
      chequeImageName: selectedFile.name,
      timestamp: new Date().toISOString()
    };

    try {
      console.log("Submitting Cheque Bill (Simulated):", chequeBillPayload);
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      alert("Cheque verified and submitted successfully!");
      navigate('/billing'); 
    } catch (error) {
      console.error("Error submitting cheque:", error);
      alert("Failed to process cheque. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="cheque-container">
      <header className="cheque-header">
        <div className="header-left">
          <button className="back-btn"  onClick={() => navigate(-1)}>
            <FaArrowLeft />
          </button>
          <h1 className="header-title">Cheque Verification</h1>
        </div>
        <div className="header-right">
          <span className="bill-total-label">BILL TOTAL</span>
          <span className="bill-total-amount">${billTotal.toFixed(2)}</span>
        </div>
      </header>

      <main className="cheque-content">
        <div className="cheque-card">
          <div className="doc-icon-wrapper">
            <FaFileAlt className="doc-icon" />
          </div>

          <h2 className="card-title">Cheque Upload</h2>
          <p className="card-subtitle">Capture a clear photo of the signed cheque.</p>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />

          <div 
            className="upload-box" 
            onClick={handleUploadClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {previewUrl ? (
              <div className="image-preview">
                <img src={previewUrl} alt="Cheque preview" />
              </div>
            ) : (
              <>
                <div className="camera-icon-wrapper">
                  <FaCamera className="camera-icon" />
                </div>
                <div className="upload-text">
                  <span className="primary-text">Tap to Capture Photo</span>
                  <span className="secondary-text">OR DRAG AND DROP IMAGE</span>
                </div>
              </>
            )}
          </div>

          <div className="warning-banner">
            <FaExclamationCircle className="warning-icon" />
            <span>ENSURE THE CHEQUE NUMBER AND SIGNATURE ARE VISIBLE</span>
          </div>

          <button className="submit-btn" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Cheque'}
          </button>

          <button className="cancel-btn" onClick={() => navigate(-1)}>
            Cancel & Go Back
          </button>
        </div>
      </main>
    </div>
  );
};

export default ChequeVerification;