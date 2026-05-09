// src/components/Toast.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export const toastConfig = {
  queue: [],
  show: null,
};

const Toast = ({ message, type = 'info', duration = 3000, onHide }) => {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(duration),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide?.();
    });
  }, [fadeAnim, duration, onHide]);

  const backgroundColor = {
    success: '#4caf50',
    error: '#f44336',
    warning: '#ff9800',
    info: '#2196f3',
  }[type] || '#2196f3';

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.toast, { backgroundColor }]}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  toast: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

/**
 * Afficher un toast
 */
export const showToast = (message, type = 'info', duration = 3000) => {
  toastConfig.queue.push({ message, type, duration });
  if (toastConfig.show) {
    toastConfig.show();
  }
};

/**
 * Fonctions raccourcies
 */
export const toast = {
  success: (msg, duration) => showToast(msg, 'success', duration),
  error: (msg, duration) => showToast(msg, 'error', duration),
  warning: (msg, duration) => showToast(msg, 'warning', duration),
  info: (msg, duration) => showToast(msg, 'info', duration),
};

export default Toast;
