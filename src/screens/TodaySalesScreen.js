import React, { useState, useCallback } from "react";
import {
    View,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AppText from "../components/AppText";
import api from "../api/api";

const BG = "#F5F1E8";
const WHITE = "#FFFFFF";
const ACCENT = "#3A6FF7";

export default function TodaySalesScreen({ navigation }) {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchSales = async () => {
        try {
            setLoading(true);
            const res = await api.get("/sales/today");
            setSales(res.data || []);
        } catch (err) {
            console.log("Fetch error:", err.response?.data || err.message);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchSales();
        }, [])
    );

    const grandTotal = sales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const totalItems = sales.reduce((sum, s) => sum + Number(s.qty || 0), 0);

    const today = new Date().toLocaleDateString("en-GB");

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.content}>

                {/* Header */}
                <View style={s.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <AppText style={s.backText}>‹ Back</AppText>
                    </TouchableOpacity>
                </View>

                <AppText font="satoshi" style={s.title}>Today's Sales</AppText>
                <AppText style={s.date}>{today}</AppText>

                {loading ? (
                    <AppText style={s.empty}>Loading…</AppText>
                ) : sales.length === 0 ? (
                    <AppText style={s.empty}>No sales recorded today.</AppText>
                ) : (
                    <>
                        {/* Table */}
                        <View style={s.table}>
                            {/* Header row */}
                            <View style={[s.row, s.headerRowTable]}>
                                <AppText font="satoshi" style={[s.cell, s.colDesc, s.th]}>PRODUCT</AppText>
                                <AppText font="satoshi" style={[s.cell, s.colNum, s.th]}>QTY</AppText>
                                <AppText font="satoshi" style={[s.cell, s.colNum, s.th]}>RATE</AppText>
                                <AppText font="satoshi" style={[s.cell, s.colNum, s.th]}>AMOUNT</AppText>
                            </View>

                            {/* Sale rows */}
                            {sales.map((item, i) => (
                                <View key={i} style={[s.row, i % 2 === 0 && s.rowAlt]}>
                                    <AppText style={[s.cell, s.colDesc]} numberOfLines={1}>
                                        {item.description}
                                    </AppText>
                                    <AppText style={[s.cell, s.colNum]}>
                                        {Number(item.qty || 0).toFixed(0)}
                                    </AppText>
                                    <AppText style={[s.cell, s.colNum]}>
                                        ₹{Number(item.rate || 0).toFixed(2)}
                                    </AppText>
                                    <AppText style={[s.cell, s.colNum]}>
                                        ₹{Number(item.amount || 0).toFixed(2)}
                                    </AppText>
                                </View>
                            ))}
                        </View>

                        {/* Summary footer */}
                        <View style={s.footer}>
                            <View style={s.footerRow}>
                                <AppText style={s.footerLabel}>Total Items Sold</AppText>
                                <AppText font="satoshi" style={s.footerValue}>{totalItems}</AppText>
                            </View>
                            <View style={s.divider} />
                            <View style={s.footerRow}>
                                <AppText style={s.footerLabel}>Total Revenue</AppText>
                                <AppText font="satoshi" style={s.footerTotal}>₹{grandTotal.toFixed(2)}</AppText>
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    content: { padding: 16, paddingBottom: 40 },

    headerRow: { marginBottom: 4 },
    backBtn: { paddingVertical: 4 },
    backText: { color: ACCENT, fontSize: 16, fontWeight: "600" },

    title: { fontSize: 30, marginBottom: 4 },
    date: { fontSize: 13, color: "#666", marginBottom: 20 },

    table: {
        backgroundColor: WHITE,
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 16,
    },

    headerRowTable: {
        backgroundColor: "#111",
        paddingVertical: 10,
        paddingHorizontal: 12,
    },

    row: {
        flexDirection: "row",
        paddingVertical: 10,
        paddingHorizontal: 12,
        alignItems: "center",
    },
    rowAlt: { backgroundColor: "#F7F5EF" },

    cell: { fontSize: 12, color: "#222" },
    th: { color: "#fff", fontWeight: "700", fontSize: 11, letterSpacing: 0.5 },

    colDesc: { flex: 2.5, paddingRight: 4 },
    colNum: { flex: 1, textAlign: "right" },

    footer: {
        backgroundColor: WHITE,
        borderRadius: 18,
        padding: 16,
    },
    footerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 6,
    },
    divider: { height: 1, backgroundColor: "#eee", marginVertical: 4 },
    footerLabel: { fontSize: 14, color: "#555" },
    footerValue: { fontSize: 16, color: "#111", fontWeight: "600" },
    footerTotal: { fontSize: 20, color: ACCENT, fontWeight: "700" },

    empty: { textAlign: "center", marginTop: 40, color: "#888" },
});
