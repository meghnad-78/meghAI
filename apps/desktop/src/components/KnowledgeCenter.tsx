import React, { useState, useEffect } from 'react';
import type { GraphEntityType } from '@meghai/knowledge-graph';

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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', overflowY: 'auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>Personal Knowledge Graph</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Structured graph linking people, projects, tasks, tools, files, and domains.
          </p>
        </div>
        <button
          onClick={loadGraph}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#38bdf8',
            borderRadius: '8px',
            padding: '6px 14px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Add Entity Box */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '10px' }}>
          + Add Entity to Knowledge Graph
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            value={newNodeType}
            onChange={e => setNewNodeType(e.target.value as any)}
            style={{
              background: 'rgba(7, 9, 14, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#cbd5e1',
              fontSize: '13px'
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
              background: 'rgba(7, 9, 14, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#f8fafc',
              fontSize: '13px'
            }}
          />
          <button
            onClick={handleAddNode}
            style={{
              background: 'linear-gradient(135deg, #00f0ff, #8a2be2)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#07090e',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Add Entity
          </button>
        </div>
      </div>

      {/* Main 2-Column Split: Graph Nodes + Neighborhood Inspector */}
      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
        {/* Left Column: Entities List */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(15, 23, 42, 0.55)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '16px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>Entities ({filteredNodes.length})</span>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{ background: 'rgba(7, 9, 14, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#cbd5e1', borderRadius: '6px', padding: '4px 8px', fontSize: '12px' }}
            >
              <option value="">All Types</option>
              <option value="USER">User</option>
              <option value="PROJECT">Project</option>
              <option value="APPLICATION">Application</option>
              <option value="TOPIC">Topic</option>
              <option value="ORGANIZATION">Organization</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredNodes.map(node => {
              const isSelected = selectedNode?.id === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  style={{
                    background: isSelected ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${isSelected ? '#00f0ff' : 'rgba(255, 255, 255, 0.06)'}`,
                    borderRadius: '8px',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(138, 43, 226, 0.2)',
                      color: '#c084fc',
                      fontWeight: 700
                    }}>
                      {node.type}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                      {node.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{node.id}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Node Details & Relationships */}
        <div style={{ width: '380px', display: 'flex', flexDirection: 'column', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '16px', overflowY: 'auto' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#cbd5e1', marginBottom: '14px' }}>
            Entity Details & Neighborhood
          </div>

          {selectedNode ? (
            <div>
              <div style={{ background: 'rgba(7, 9, 14, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#00f0ff', marginBottom: '4px' }}>
                  {selectedNode.label}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Type: {selectedNode.type}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>ID: {selectedNode.id}</div>
                {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#cbd5e1' }}>
                    <pre style={{ margin: 0, padding: '6px', background: 'rgba(0, 0, 0, 0.4)', borderRadius: '4px', overflowX: 'auto' }}>
                      {JSON.stringify(selectedNode.properties, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' }}>
                Connected Relationships ({nodeNeighbors.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {nodeNeighbors.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#64748b', padding: '12px 0' }}>
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
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          fontSize: '12px'
                        }}
                      >
                        <div style={{ color: '#38bdf8', fontWeight: 600 }}>
                          {isOutgoing ? `→ ${edge.relationship} →` : `← ${edge.relationship} ←`}
                        </div>
                        <div style={{ color: '#f8fafc', marginTop: '2px', fontWeight: 500 }}>
                          {otherNode ? otherNode.label : otherNodeId}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', marginTop: '40px' }}>
              Select an entity on the left to inspect its graph neighborhood.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
