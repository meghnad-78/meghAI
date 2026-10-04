import React, { useState, useEffect } from 'react';
import type { GraphEntityType } from '@meghai/knowledge-graph';
import { tokens } from '../theme/tokens.js';
import { Icons } from './ui/Icons.js';

interface GraphNode {
  id: string;
  type: string;
  label: string;
  properties?: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relationship: string;
  weight?: number;
}

export const KnowledgeCenter: React.FC = () => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [newNodeType, setNewNodeType] = useState<GraphEntityType>('TOPIC');
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [filterType, setFilterType] = useState('');

  const loadGraph = async () => {
    try {
      const res = await fetch('/api/v1/knowledge/graph');
      const data = await res.json() as any;
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      if (!selectedNode && data.nodes?.length > 0) {
        setSelectedNode(data.nodes[0]);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadGraph();
  }, []);

  const handleAddNode = async () => {
    if (!newNodeLabel.trim()) return;
    try {
      await fetch('/api/v1/knowledge/node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newNodeType,
          label: newNodeLabel,
          properties: { createdVia: 'Knowledge Center UI' }
        })
      });
      setNewNodeLabel('');
      loadGraph();
    } catch {
      // Handle error
    }
  };

  const filteredNodes = nodes.filter(n => {
    if (filterType && n.type !== filterType) return false;
    return true;
  });

  const nodeNeighbors = selectedNode
    ? edges.filter(e => e.fromNodeId === selectedNode.id || e.toNodeId === selectedNode.id)
    : [];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '28px 36px',
        overflowY: 'auto',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: `1px solid ${tokens.colors.border.subtle}`,
          paddingBottom: '20px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: tokens.colors.accent.primary, display: 'flex', alignItems: 'center' }}>
              <Icons.CompassNode size={22} />
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: tokens.typography.sizes.xl,
                fontWeight: 600,
                color: tokens.colors.text.primary,
                letterSpacing: tokens.typography.letterSpacing.tight,
                fontFamily: tokens.typography.fontDisplay
              }}
            >
              Personal Knowledge Graph
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: tokens.typography.sizes.sm, color: tokens.colors.text.secondary }}>
            Relational semantic graph linking entities, projects, tasks, tools, files, and domains.
          </p>
        </div>
        <button
          onClick={loadGraph}
          style={{
            background: tokens.colors.bg.surface,
            border: `1px solid ${tokens.colors.border.default}`,
            color: tokens.colors.text.secondary,
            borderRadius: tokens.radii.xs,
            padding: '6px 14px',
            cursor: 'pointer',
            fontSize: tokens.typography.sizes.xs,
            fontFamily: tokens.typography.fontMono
          }}
        >
          REFRESH
        </button>
      </div>

      {/* Add Entity Box */}
      <div
        style={{
          background: tokens.colors.bg.surface,
          border: `1px solid ${tokens.colors.border.default}`,
          borderRadius: tokens.radii.md,
          padding: '16px',
          marginBottom: '20px'
        }}
      >
        <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 600, color: tokens.colors.text.secondary, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
          Create Graph Entity
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            value={newNodeType}
            onChange={e => setNewNodeType(e.target.value as any)}
            style={{
              background: tokens.colors.bg.subtle,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.sm,
              padding: '8px 12px',
              color: tokens.colors.text.secondary,
              fontSize: tokens.typography.sizes.xs
            }}
          >
            <option value="PROJECT">PROJECT</option>
            <option value="TOPIC">TOPIC</option>
            <option value="ORGANIZATION">ORGANIZATION</option>
            <option value="APPLICATION">APPLICATION</option>
            <option value="PERSON">PERSON</option>
            <option value="FILE">FILE</option>
          </select>
          <input
            type="text"
            placeholder="Entity label (e.g. Distributed Consensus, Cloud Database)"
            value={newNodeLabel}
            onChange={e => setNewNodeLabel(e.target.value)}
            style={{
              flex: 1,
              background: tokens.colors.bg.subtle,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.sm,
              padding: '8px 12px',
              color: tokens.colors.text.primary,
              fontSize: tokens.typography.sizes.sm,
              outline: 'none'
            }}
          />
          <button
            onClick={handleAddNode}
            style={{
              background: tokens.colors.accent.primary,
              border: 'none',
              borderRadius: tokens.radii.sm,
              padding: '8px 16px',
              color: tokens.colors.bg.canvas,
              fontWeight: 600,
              fontSize: tokens.typography.sizes.xs,
              cursor: 'pointer',
              fontFamily: tokens.typography.fontMono
            }}
          >
            INSERT ENTITY
          </button>
        </div>
      </div>

      {/* Main 2-Column Split: Graph Nodes + Neighborhood Inspector */}
      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Left Column: Entities List */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: tokens.colors.bg.surface,
            border: `1px solid ${tokens.colors.border.default}`,
            borderRadius: tokens.radii.md,
            padding: '16px',
            overflowY: 'auto'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary }}>
              Entities ({filteredNodes.length})
            </span>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{
                background: tokens.colors.bg.subtle,
                border: `1px solid ${tokens.colors.border.default}`,
                color: tokens.colors.text.secondary,
                borderRadius: tokens.radii.xs,
                padding: '4px 8px',
                fontSize: tokens.typography.sizes.xs
              }}
            >
              <option value="">All Types</option>
              <option value="USER">User</option>
              <option value="PROJECT">Project</option>
              <option value="APPLICATION">Application</option>
              <option value="TOPIC">Topic</option>
              <option value="ORGANIZATION">Organization</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredNodes.map(node => {
              const isSelected = selectedNode?.id === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  style={{
                    background: isSelected ? tokens.colors.bg.elevated : tokens.colors.bg.subtle,
                    border: `1px solid ${isSelected ? tokens.colors.accent.primary : tokens.colors.border.subtle}`,
                    borderRadius: tokens.radii.sm,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: tokens.transitions.fast
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: tokens.radii.xs,
                        background: tokens.colors.bg.surface,
                        border: `1px solid ${tokens.colors.border.default}`,
                        color: tokens.colors.accent.primary,
                        fontWeight: 600,
                        fontFamily: tokens.typography.fontMono
                      }}
                    >
                      {node.type}
                    </span>
                    <span style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 500, color: tokens.colors.text.primary }}>
                      {node.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: tokens.colors.text.muted, fontFamily: tokens.typography.fontMono }}>{node.id}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Node Details & Relationships */}
        <div
          style={{
            width: '400px',
            display: 'flex',
            flexDirection: 'column',
            background: tokens.colors.bg.surface,
            border: `1px solid ${tokens.colors.border.default}`,
            borderRadius: tokens.radii.md,
            padding: '16px',
            overflowY: 'auto'
          }}
        >
          <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 600, color: tokens.colors.text.secondary, marginBottom: '14px', textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
            Entity Details & Neighborhood
          </div>

          {selectedNode ? (
            <div>
              <div
                style={{
                  background: tokens.colors.bg.subtle,
                  border: `1px solid ${tokens.colors.border.default}`,
                  borderRadius: tokens.radii.sm,
                  padding: '12px',
                  marginBottom: '16px'
                }}
              >
                <div style={{ fontSize: tokens.typography.sizes.md, fontWeight: 600, color: tokens.colors.text.primary, marginBottom: '4px', fontFamily: tokens.typography.fontDisplay }}>
                  {selectedNode.label}
                </div>
                <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.accent.primary, fontFamily: tokens.typography.fontMono }}>
                  Type: {selectedNode.type}
                </div>
                <div style={{ fontSize: '11px', color: tokens.colors.text.muted, marginTop: '2px', fontFamily: tokens.typography.fontMono }}>
                  ID: {selectedNode.id}
                </div>
                {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '11px' }}>
                    <pre style={{ margin: 0, padding: '8px', background: tokens.colors.bg.canvas, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radii.xs, overflowX: 'auto', fontFamily: tokens.typography.fontMono, color: tokens.colors.text.secondary }}>
                      {JSON.stringify(selectedNode.properties, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 600, color: tokens.colors.text.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
                Connected Relationships ({nodeNeighbors.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {nodeNeighbors.length === 0 ? (
                  <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, padding: '12px 0' }}>
                    No direct relationship edges connected to this entity yet.
                  </div>
                ) : (
                  nodeNeighbors.map(edge => {
                    const isOutgoing = edge.fromNodeId === selectedNode.id;
                    const otherNodeId = isOutgoing ? edge.toNodeId : edge.fromNodeId;
                    const otherNode = nodes.find(n => n.id === otherNodeId);
                    return (
                      <div
                        key={edge.id}
                        style={{
                          background: tokens.colors.bg.subtle,
                          border: `1px solid ${tokens.colors.border.subtle}`,
                          borderRadius: tokens.radii.xs,
                          padding: '8px 10px',
                          fontSize: tokens.typography.sizes.xs
                        }}
                      >
                        <div style={{ color: tokens.colors.accent.primary, fontWeight: 600, fontFamily: tokens.typography.fontMono }}>
                          {isOutgoing ? `-> ${edge.relationship} ->` : `<- ${edge.relationship} <-`}
                        </div>
                        <div style={{ color: tokens.colors.text.primary, marginTop: '2px', fontWeight: 500 }}>
                          {otherNode ? otherNode.label : otherNodeId}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div style={{ color: tokens.colors.text.muted, fontSize: tokens.typography.sizes.xs, textAlign: 'center', marginTop: '40px' }}>
              Select an entity to inspect its graph neighborhood.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
