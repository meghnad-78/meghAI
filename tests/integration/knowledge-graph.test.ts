import { describe, it, expect } from 'vitest';
import { PersonalKnowledgeGraph } from '../../packages/knowledge-graph/src/index';

describe('PersonalKnowledgeGraph Integration', () => {
  it('creates typed entities, establishes directional edges, and resolves neighbors', () => {
    const pkg = new PersonalKnowledgeGraph();

    const user = pkg.addNode('USER', 'Meghnad Saha', { role: 'Principal Architect' }, 'user-meghnad');
    const project = pkg.addNode('PROJECT', 'MeghAI', { status: 'active' }, 'proj-meghai');
    const note = pkg.addNode('NOTE', 'Architecture Spec', { format: 'markdown' }, 'note-arch');

    // Link User -> WorksOn -> Project
    pkg.addEdge(user.id, project.id, 'WORKS_ON');
    // Link Project -> PartOf / RelatedTo -> Note
    pkg.addEdge(project.id, note.id, 'RELATED_TO');

    expect(pkg.getNode('user-meghnad')?.label).toBe('Meghnad Saha');

    // Neighbors of user with WORKS_ON relationship
    const userProjects = pkg.getNeighbors(user.id, 'WORKS_ON');
    expect(userProjects.length).toBe(1);
    expect(userProjects[0].id).toBe('proj-meghai');

    // Neighbors of project
    const projectItems = pkg.getNeighbors(project.id);
    expect(projectItems.length).toBe(1);
    expect(projectItems[0].id).toBe('note-arch');

    expect(pkg.getAllNodes().length).toBe(3);
    expect(pkg.getAllEdges().length).toBe(2);
  });
});
