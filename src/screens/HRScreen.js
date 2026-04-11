// src/screens/HRScreen.js

import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Alert, Modal,
} from 'react-native';
import { COLORS, formatDA } from '../services/theme';
import { MOCK_DATA } from '../services/api';
import {
  Card, KpiCard, Badge, Avatar, SectionTitle, Divider,
  RowBetween, ProgressBar, SearchBar,
} from '../components/UIComponents';

const PAYROLL = [
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
  const [employees, setEmployees] = useState(MOCK_DATA.employees);
  const [selectedEmp, setSelectedEmp] = useState(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 600));
    setRefreshing(false);
  };

  const filteredEmps = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase())
  );

  const presentCount = employees.filter(e => e.status === 'present').length;
  const absentCount = employees.filter(e => e.status === 'absent' || e.status === 'leave').length;

  const cycleStatus = (emp) => {
    const statuses = ['present', 'absent', 'leave'];
    const next = statuses[(statuses.indexOf(emp.status) + 1) % statuses.length];
    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: next } : e));
  };

  const totalPayroll = PAYROLL.reduce((s, p) => s + p.salary, 0);

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

        {/* Tabs */}
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

        {/* Attendance */}
        {tab === 'attendance' && (
          <>
            <SectionTitle>Présences — Aujourd'hui</SectionTitle>
            <Card style={{ paddingVertical: 4 }}>
              {filteredEmps.map((emp, i) => (
                <View key={emp.id}>
                  <TouchableOpacity
                    style={styles.empRow}
                    onPress={() => cycleStatus(emp)}
                    activeOpacity={0.7}
                  >
                    <Avatar initials={emp.initials} bg={emp.color} textColor={emp.textColor} />
                    <View style={styles.empInfo}>
                      <Text style={styles.empName}>{emp.name}</Text>
                      <Text style={styles.empRole}>{emp.role}</Text>
                    </View>
                    <Badge status={emp.status} />
                  </TouchableOpacity>
                  {i < filteredEmps.length - 1 && <Divider />}
                </View>
              ))}
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

        {/* Payroll */}
        {tab === 'payroll' && (
          <>
            <SectionTitle>Masse salariale — Avril 2026</SectionTitle>
            <Card>
              <RowBetween>
                <Text style={styles.statLabel}>Total mensuel</Text>
                <Text style={[styles.statValue, { color: COLORS.primary }]}>{formatDA(totalPayroll)}</Text>
              </RowBetween>
              <Divider />
              <RowBetween>
                <Text style={styles.statLabel}>Charges sociales (~26%)</Text>
                <Text style={[styles.statValue, { color: COLORS.warning }]}>{formatDA(Math.round(totalPayroll * 0.26))}</Text>
              </RowBetween>
              <Divider />
              <RowBetween>
                <Text style={[styles.statLabel, { fontWeight: '600' }]}>Coût total employeur</Text>
                <Text style={[styles.statValue, { color: COLORS.danger, fontWeight: '600' }]}>{formatDA(Math.round(totalPayroll * 1.26))}</Text>
              </RowBetween>
            </Card>

            <SectionTitle>Détail par employé</SectionTitle>
            <Card style={{ paddingVertical: 4 }}>
              {PAYROLL.filter(p =>
                p.name.toLowerCase().includes(search.toLowerCase())
              ).map((p, i) => (
                <View key={p.id}>
                  <View style={styles.empRow}>
                    <Avatar initials={p.initials} bg={p.bg} textColor={p.tc} />
                    <View style={styles.empInfo}>
                      <Text style={styles.empName}>{p.name}</Text>
                      <Text style={styles.empRole}>{p.role}</Text>
                    </View>
                    <Text style={[styles.salaryText, { color: COLORS.primary }]}>{formatDA(p.salary)}</Text>
                  </View>
                  {i < PAYROLL.length - 1 && <Divider />}
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
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    alignItems: 'center', backgroundColor: '#fff',
    borderWidth: 0.5, borderColor: '#E0E0E0',
  },
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
});
