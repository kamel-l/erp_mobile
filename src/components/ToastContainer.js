// src/components/ToastContainer.js
import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Toast, { toastConfig } from './Toast';

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(() => {
    if (toastConfig.queue.length > 0) {
      const toastItem = toastConfig.queue.shift();
      const id = Date.now();
      
      setToasts(prev => [...prev, { id, ...toastItem }]);
    }
  }, []);

  const hideToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    // Afficher le prochain toast en queue
    setTimeout(showToast, 0);
  }, [showToast]);

  // Assigner la fonction show au config
  toastConfig.show = showToast;

  return (
    <View style={styles.container}>
      {toasts.map(toastItem => (
        <Toast
          key={toastItem.id}
          message={toastItem.message}
          type={toastItem.type}
          duration={toastItem.duration}
          onHide={() => hideToast(toastItem.id)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
});

export default ToastContainer;
