import { type Edge } from '../lib/game';

export interface Point {
  x: number;
  y: number;
}

function getHexHeight(radius: number): number {
  return Math.sqrt(3) * radius;
}

export function getHexPoints(
  radius: number,
  centerX: number,
  centerY: number,
): string {
  const height = getHexHeight(radius);
  const points = [
    [radius, 0],
    [radius / 2, height / 2],
    [-radius / 2, height / 2],
    [-radius, 0],
    [-radius / 2, -height / 2],
    [radius / 2, -height / 2],
  ];

  return points.map(([x, y]) => `${centerX + x},${centerY + y}`).join(' ');
}

export function getHexVertices(
  radius: number,
  centerX: number,
  centerY: number,
): Point[] {
  const height = getHexHeight(radius);

  return [
    { x: centerX + radius, y: centerY },
    { x: centerX + radius / 2, y: centerY + height / 2 },
    { x: centerX - radius / 2, y: centerY + height / 2 },
    { x: centerX - radius, y: centerY },
    { x: centerX - radius / 2, y: centerY - height / 2 },
    { x: centerX + radius / 2, y: centerY - height / 2 },
  ];
}

export function getEdgeMidpoint(radius: number, edge: Edge): Point {
  const height = getHexHeight(radius);

  switch (edge) {
    case 0:
      return { x: 0, y: -height / 2 };
    case 1:
      return { x: radius * 0.75, y: -height / 4 };
    case 2:
      return { x: radius * 0.75, y: height / 4 };
    case 3:
      return { x: 0, y: height / 2 };
    case 4:
      return { x: -radius * 0.75, y: height / 4 };
    case 5:
      return { x: -radius * 0.75, y: -height / 4 };
  }
}

export function getTrackPath(
  radius: number,
  centerX: number,
  centerY: number,
  entryEdge: Edge,
  exitEdge: Edge,
): string {
  const start = getEdgeMidpoint(radius, entryEdge);
  const end = getEdgeMidpoint(radius, exitEdge);

  if ((entryEdge + 3) % 6 === exitEdge) {
    return `M ${centerX + start.x} ${centerY + start.y} L ${centerX + end.x} ${centerY + end.y}`;
  }

  return `M ${centerX + start.x} ${centerY + start.y} Q ${centerX} ${centerY} ${centerX + end.x} ${centerY + end.y}`;
}

export function getEdgeSegment(
  radius: number,
  centerX: number,
  centerY: number,
  edge: Edge,
  inset = 0.2,
): { x1: number; y1: number; x2: number; y2: number } {
  const vertices = getHexVertices(radius, centerX, centerY);
  const edgeVertices: Record<Edge, [number, number]> = {
    0: [4, 5],
    1: [5, 0],
    2: [0, 1],
    3: [1, 2],
    4: [2, 3],
    5: [3, 4],
  };
  const [startIndex, endIndex] = edgeVertices[edge];
  const start = vertices[startIndex];
  const end = vertices[endIndex];

  return {
    x1: start.x + (centerX - start.x) * inset,
    y1: start.y + (centerY - start.y) * inset,
    x2: end.x + (centerX - end.x) * inset,
    y2: end.y + (centerY - end.y) * inset,
  };
}

export function getEdgeTieSegment(
  radius: number,
  centerX: number,
  centerY: number,
  edge: Edge,
  lengthScale = 0.68,
): { x1: number; y1: number; x2: number; y2: number } {
  const vertices = getHexVertices(radius, centerX, centerY);
  const edgeVertices: Record<Edge, [number, number]> = {
    0: [4, 5],
    1: [5, 0],
    2: [0, 1],
    3: [1, 2],
    4: [2, 3],
    5: [3, 4],
  };
  const [startIndex, endIndex] = edgeVertices[edge];
  const start = vertices[startIndex];
  const end = vertices[endIndex];
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  return {
    x1: midpoint.x - dx * lengthScale * 0.5,
    y1: midpoint.y - dy * lengthScale * 0.5,
    x2: midpoint.x + dx * lengthScale * 0.5,
    y2: midpoint.y + dy * lengthScale * 0.5,
  };
}

function getQuadraticPoint(
  start: Point,
  control: Point,
  end: Point,
  t: number,
): Point {
  const inverse = 1 - t;

  return {
    x:
      inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    y:
      inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
  };
}

function normalize(dx: number, dy: number): Point {
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function toPath(points: Point[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

export function getRailPaths(
  radius: number,
  centerX: number,
  centerY: number,
  entryEdge: Edge,
  exitEdge: Edge,
  offset: number,
): { left: string; right: string } {
  const startOffset = getEdgeMidpoint(radius, entryEdge);
  const endOffset = getEdgeMidpoint(radius, exitEdge);
  const start = { x: centerX + startOffset.x, y: centerY + startOffset.y };
  const end = { x: centerX + endOffset.x, y: centerY + endOffset.y };
  const points: Point[] = [];

  if ((entryEdge + 3) % 6 === exitEdge) {
    points.push(start, end);
  } else {
    const control = { x: centerX, y: centerY };

    for (let index = 0; index <= 16; index += 1) {
      points.push(getQuadraticPoint(start, control, end, index / 16));
    }
  }

  const leftPoints = points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)] ?? point;
    const next = points[Math.min(points.length - 1, index + 1)] ?? point;
    const tangent = normalize(next.x - previous.x, next.y - previous.y);
    const normal = { x: -tangent.y, y: tangent.x };

    return {
      x: point.x + normal.x * offset,
      y: point.y + normal.y * offset,
    };
  });
  const rightPoints = points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)] ?? point;
    const next = points[Math.min(points.length - 1, index + 1)] ?? point;
    const tangent = normalize(next.x - previous.x, next.y - previous.y);
    const normal = { x: -tangent.y, y: tangent.x };

    return {
      x: point.x - normal.x * offset,
      y: point.y - normal.y * offset,
    };
  });

  return {
    left: toPath(leftPoints),
    right: toPath(rightPoints),
  };
}
