import crypto from 'node:crypto';

export type GraphEntityType =
  | 'USER'
  | 'PERSON'
  | 'PROJECT'
  | 'TASK'
  | 'FILE'
  | 'FOLDER'
  | 'APPLICATION'
  | 'EVENT'
  | 'MEETING'
  | 'MESSAGE'
  | 'EMAIL'
  | 'NOTE'
  | 'TOPIC'
  | 'ORGANIZATION'
  | 'PREFERENCE'
  | 'ROUTINE'
  | 'MEMORY'
  | 'CONVERSATION'
  | 'WORKSPACE';

export type RelationshipType =
  | 'RELATED_TO'
  | 'WORKS_ON'
  | 'BELONGS_TO'
  | 'PART_OF'
  | 'MENTIONED_IN'
  | 'SENT_TO'
  | 'RECEIVED_FROM'
  | 'DEPENDS_ON'
  | 'SCHEDULED_FOR'
  | 'PREFERS'
  | 'USED_WITH'
  | 'ASSOCIATED_WITH';

export interface GraphNode {
  id: string;
  type: GraphEntityType;
  label: string;
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relationship: RelationshipType;
  weight?: number;
  properties?: Record<string, unknown>;
}

/**
 * Personal Knowledge Graph (Section 26)
 */
export class PersonalKnowledgeGraph {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge>();

  public addNode(type: GraphEntityType, label: string, properties: Record<string, unknown> = {}, customId?: string): GraphNode {
    const id = customId || `node-${crypto.randomUUID()}`;
    const node: GraphNode = { id, type, label, properties };
    this.nodes.set(id, node);
    return node;
  }

  public addEdge(fromNodeId: string, toNodeId: string, relationship: RelationshipType, weight = 1.0): GraphEdge {
    const id = `edge-${fromNodeId}-${relationship}-${toNodeId}`;
    const edge: GraphEdge = { id, fromNodeId, toNodeId, relationship, weight };
    this.edges.set(id, edge);
    return edge;
  }

  public getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  public getNeighbors(nodeId: string, relationship?: RelationshipType): GraphNode[] {
    const result: GraphNode[] = [];
    for (const edge of this.edges.values()) {
      if (edge.fromNodeId === nodeId) {
        if (!relationship || edge.relationship === relationship) {
          const target = this.nodes.get(edge.toNodeId);
          if (target) result.push(target);
        }
      }
    }
    return result;
  }

  public getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  public getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }
}
