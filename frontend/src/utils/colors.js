// Color palette
export const COLORS = {
    regular: {
        node: '#0366d6',
        selected: '#f9826c',
        hover: '#58a6ff'
    },
    initial: {
        node: '#2ea44f',
        selected: '#56d364',
        hover: '#3fb950'
    },
    merge: {
        node: '#6f42c1',
        selected: '#8957e5',
        hover: '#8b949e'
    }
};

export const getNodeColor = (nodeData, isSelected = false) => {
    if (nodeData.data.is_initial) {
        return isSelected ? COLORS.initial.selected : COLORS.initial.node;
    }
    if (nodeData.data.is_merge) {
        return isSelected ? COLORS.merge.selected : COLORS.merge.node;
    }
    return isSelected ? COLORS.regular.selected : COLORS.regular.node;
};

export const getEdgeColor = (edgeData, isHighlighted = false) => {
    if (isHighlighted) {
        return '#58a6ff';
    }
    return edgeData.data.is_merge ? '#6e7681' : '#30363d';
};

export const getHoverColor = (nodeData) => {
    if (nodeData.data.is_initial) return COLORS.initial.hover;
    if (nodeData.data.is_merge) return COLORS.merge.hover;
    return COLORS.regular.hover;
};