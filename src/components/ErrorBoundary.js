// src/components/ErrorBoundary.js
import React, { Component } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { logger } from '../services/logger';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState(prev => ({
      error,
      errorInfo,
      errorCount: prev.errorCount + 1,
    }));

    logger.error('React Error Boundary', { error: error.toString(), ...errorInfo });

    // Si trop d'erreurs, proposer reset
    if (this.state.errorCount > 5) {
      logger.error('Trop d\'erreurs détectées', { count: this.state.errorCount });
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
            <Text style={styles.title}>⚠️ Oups! Une erreur est survenue</Text>
            
            <Text style={styles.errorMessage}>
              {this.state.error?.toString()}
            </Text>

            {__DEV__ && this.state.errorInfo && (
              <View style={styles.devSection}>
                <Text style={styles.devTitle}>🔧 Détails (Dev Only)</Text>
                <Text style={styles.devText}>
                  {this.state.errorInfo.componentStack}
                </Text>
              </View>
            )}

            <TouchableOpacity 
              style={styles.button} 
              onPress={this.resetError}
            >
              <Text style={styles.buttonText}>Réessayer</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.buttonSecondary]} 
              onPress={() => logger.clearLogs()}
            >
              <Text style={styles.buttonText}>Effacer les logs</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 15,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 24,
  },
  devSection: {
    backgroundColor: '#f5f5f5',
    borderLeftWidth: 4,
    borderLeftColor: '#ff6f00',
    padding: 10,
    marginBottom: 20,
    borderRadius: 4,
  },
  devTitle: {
    fontWeight: 'bold',
    color: '#ff6f00',
    marginBottom: 10,
  },
  devText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
  },
  button: {
    backgroundColor: '#1976D2',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonSecondary: {
    backgroundColor: '#757575',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ErrorBoundary;
