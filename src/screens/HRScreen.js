import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Alert, ActivityIndicator, // ← ajout
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, KpiCard, Badge, Avatar, SectionTitle, Divider,
  RowBetween, ProgressBar, SearchBar,
} from '../components/UIComponents';
import { getEmployeesOffline, saveEmployeesOffline } from '../database/offlineStorage';

const DEFAULT_PAYROLL = [
  { id: 1, name: 'Ali Mansouri', role: 'Responsable ventes', salary: 85000, initials: 'AM', bg: '#E3F2FD', tc: '#0D47A1' },
  { id: 2, name: 'Fatima Bouzid', role: 'Comptable', salary: 75000, initials: 'FB', bg: '#F3E5F5', tc: '#4A148C' },
  { id: 3, name: 'Yacine Djamel', role: 'Magasinier', salary: 55000, initials: 'YD', bg: '#FFF3E0', tc: '#E65100' },
  { id: 4, name: 'Samira Rais', role: 'Administratrice', salary: 70000, initials: 'SR', bg: '#E8F5E9', tc: '#1B5E20' },
  { id: 5, name: 'Kamel Mehdi', role: 'Commercial', salary: 65000, initials: 'KM', bg: '#FCE4EC', tc: '#880E4F' },
];

export default function HRScreen() {
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('attendance');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadEmployees = useCallback(async () => {
    try {
      const emps = await getEmployeesOffline();
      if (emps && emps.length) {
        setEmployees(emps);
      } else {
        const defaultEmps = DEFAULT_PAYROLL.map(e => ({
          ...e,
          status: 'present',
          color: e.bg,
          textColor: e.tc,
        }));
        setEmployees(defaultEmps);
        await saveEmployeesOffline(defaultEmps);
      }
    } catch (error) {
      console.error(error);
      setEmployees(DEFAULT_PAYROLL.map(e => ({ ...e, status: 'present' })));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadEmployees(); }, [loadEmployees]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEmployees();
    setRefreshing(false);
  };

  const cycleStatus = (emp) => {
    const statuses = ['present', 'absent', 'leave'];
    const next = statuses[(statuses.indexOf(emp.status) + 1) % statuses.length];
    const updated = employees.map(e => e.id === emp.id ? { ...e, status: next } : e);
    setEmployees(updated);
    saveEmployeesOffline(updated);
  };

  const filteredEmps = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase())
  );

  const presentCount = employees.filter(e => e.status === 'present').length;
  const absentCount = employees.filter(e => e.status === 'absent' || e.status === 'leave').length;
  const totalPayroll = DEFAULT_PAYROLL.reduce((s, p) => s + p.salary, 0);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.kpiRow}>
          <KpiCard value={employees.length} label="Employés actifs" color={COLORS.primary} style={{ marginRight: 6 }} />
          <KpiCard value={absentCount} label="Absents aujourd'hui" color={COLORS.warning} style={{ marginLeft: 6 }} />
        </View>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Chercher un employé..." />

        <View style={styles.tabRow}>
          {[{ key: 'attendance', label: 'Présences' }, { key: 'payroll', label: 'Salaires' }].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'attendance' && (
          <>
            <SectionTitle>Présences — Aujourd'hui</SectionTitle>
            <Card style={{ paddingVertical: 4 }}>
              {filteredEmps.map((emp, i) => (
                <View key={emp.id}>
                  <TouchableOpacity style={styles.empRow} onPress={() => cycleStatus(emp)} activeOpacity={0.7}>
                    <Avatar initials={emp.initials} bg={emp.color || '#E3F2FD'} textColor={emp.textColor || '#0D47A1'} />
                    <View style={styles.empInfo}>
                      <Text style={styles.empName}>{emp.name}</Text>
                      <Text style={styles.empRole}>{emp.role}</Text>
                    </View>
                    <Badge status={emp.status} />
                  </TouchableOpacity>
                  {i < filteredEmps.length - 1 && <Divider />}
                </View>
              ))}
              {filteredEmps.length === 0 && <Text style={styles.emptyText}>Aucun employé trouvé</Text>}
            </Card>
            <Card>
              <RowBetween style={{ marginBottom: 6 }}>
                <Text style={styles.statLabel}>Présents</Text>
                <Text style={[styles.statValue, { color: COLORS.success }]}>{presentCount} / {employees.length}</Text>
              </RowBetween>
              <ProgressBar value={presentCount} max={employees.length} color={COLORS.success} />
              <Text style={[styles.hintText, { marginTop: 8 }]}>Appuyer sur un employé pour changer son statut</Text>
            </Card>
          </>
        )}

        {tab === 'payroll' && (
          <>
            <SectionTitle>Masse salariale — {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</SectionTitle>
            <Card>
              <RowBetween><Text style={styles.statLabel}>Total mensuel</Text><Text style={[styles.statValue, { color: COLORS.primary }]}>{formatDA(totalPayroll)}</Text></RowBetween>
              <Divider />
              <RowBetween><Text style={styles.statLabel}>Charges sociales (~26%)</Text><Text style={[styles.statValue, { color: COLORS.warning }]}>{formatDA(Math.round(totalPayroll * 0.26))}</Text></RowBetween>
              <Divider />
              <RowBetween><Text style={[styles.statLabel, { fontWeight: '600' }]}>Coût total employeur</Text><Text style={[styles.statValue, { color: COLORS.danger, fontWeight: '600' }]}>{formatDA(Math.round(totalPayroll * 1.26))}</Text></RowBetween>
            </Card>
            <SectionTitle>Détail par employé</SectionTitle>
            <Card style={{ paddingVertical: 4 }}>
              {DEFAULT_PAYROLL.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map((p, i) => (
                <View key={p.id}>
                  <View style={styles.empRow}>
                    <Avatar initials={p.initials} bg={p.bg} textColor={p.tc} />
                    <View style={styles.empInfo}>
                      <Text style={styles.empName}>{p.name}</Text>
                      <Text style={styles.empRole}>{p.role}</Text>
                    </View>
                    <Text style={[styles.salaryText, { color: COLORS.primary }]}>{formatDA(p.salary)}</Text>
                  </View>
                  {i < DEFAULT_PAYROLL.length - 1 && <Divider />}
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 24 },
  kpiRow: { flexDirection: 'row', marginBottom: 12 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#E0E0E0' },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  tabTextActive: { color: '#fff' },
  empRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  empInfo: { flex: 1 },
  empName: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  empRole: { fontSize: 12, color: COLORS.textSecondary },
  salaryText: { fontSize: 14, fontWeight: '500' },
  statLabel: { fontSize: 13, color: COLORS.text },
  statValue: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  hintText: { fontSize: 11, color: COLORS.textSecondary, fontStyle: 'italic' },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, padding: 20, fontSize: 14 },
});