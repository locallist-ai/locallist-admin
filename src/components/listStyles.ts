import { StyleSheet } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';

/**
 * Shared styles for the dashboard list components (PlacesList, PlansList).
 * Kept in one sheet so the row layout and inline action buttons stay
 * visually identical across both modes.
 */
export const listStyles = StyleSheet.create({
    centerContentInline: { justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },

    // Swipe deck (places queue)
    deckContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingBottom: spacing.xxl },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    emptyText: { color: colors.textMain, fontSize: 18, fontFamily: fonts.body },
    reloadBtn: {
        marginTop: 20, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        borderRadius: borderRadius.sm, backgroundColor: colors.electricBlue,
    },
    reloadText: { color: '#fff', fontFamily: fonts.bodySemiBold },
    actionIndicator: { position: 'absolute', bottom: 20 },

    // List rows
    listContent: {
        paddingHorizontal: spacing.md, paddingBottom: 20,
        maxWidth: 960, alignSelf: 'center', width: '100%',
    },
    listItem: {
        backgroundColor: colors.bgCard, borderRadius: borderRadius.md,
        marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.borderColor,
        overflow: 'hidden',
    },
    listItemMain: {
        flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    },
    listThumb: { width: 52, height: 52, borderRadius: borderRadius.sm },
    listInfo: { flex: 1, marginLeft: spacing.md },
    listName: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.textMain, marginBottom: 2 },
    listSub: { fontSize: 13, fontFamily: fonts.body, color: colors.textSecondary },
    listChevron: { fontSize: 22, color: colors.textSecondary, paddingLeft: spacing.sm },

    // Inline status action buttons
    itemActions: {
        flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.borderColor,
    },
    actionBtnQueue: {
        flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
        borderRightWidth: 1, borderRightColor: colors.borderColor,
    },
    actionBtnQueueText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.electricBlue },
    actionBtnReject: {
        flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
    },
    actionBtnRejectText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.error },
    actionBtnPublish: {
        flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
    },
    actionBtnPublishText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.successEmerald },
    actionBtnBorderRight: {
        borderRightWidth: 1, borderRightColor: colors.borderColor,
    },
    actionBtnDelete: {
        flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
    },
    actionBtnDeleteText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.error },

    // Plan-specific
    planIcon: {
        width: 52, height: 52, borderRadius: borderRadius.sm,
        backgroundColor: colors.electricBlueLight, alignItems: 'center', justifyContent: 'center',
    },
    planIconText: { fontSize: 16, fontFamily: fonts.bodyBold, color: colors.electricBlue },
    planBadges: { flexDirection: 'row', gap: spacing.xs, marginRight: spacing.sm },
    publicBadge: {
        fontSize: 11, fontFamily: fonts.bodySemiBold, color: colors.successEmerald,
        backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    },

    // Load more
    loadMoreBtn: {
        alignSelf: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.electricBlue,
        marginTop: spacing.sm,
    },
    loadMoreText: { color: colors.electricBlue, fontFamily: fonts.bodySemiBold, fontSize: 14 },
});
