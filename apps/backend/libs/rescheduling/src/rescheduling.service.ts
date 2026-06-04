import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ProductionOrder } from '@omnitest/shared-types';

@Injectable()
export class ReschedulingService {
  private readonly logger = new Logger(ReschedulingService.name);
  private readonly directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8055';

  /**
   * Reschedules planned production orders to resolve overlaps.
   * Only resolves conflicts for groups that actually overlap (connected components).
   * In each group, orders are scheduled sequentially prioritized by createdAt.
   * Keeps original duration.
   */
  async reschedulePlannedOrders(): Promise<ProductionOrder[]> {
    try {
      // 1. Fetch all planned orders
      const response = await axios.get(`${this.directusUrl}/items/production_orders`, {
        params: {
          filter: {
            status: {
              _eq: 'planned',
            },
          },
        },
      });

      const orders: ProductionOrder[] = response.data.data || [];
      if (orders.length < 2) {
        this.logger.log('Fewer than 2 planned orders found. No rescheduling needed.');
        return [];
      }

      // 2. Build overlap graph (Adjacency List)
      const n = orders.length;
      const adj: number[][] = Array.from({ length: n }, () => []);

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const o1 = orders[i];
          const o2 = orders[j];

          const s1 = new Date(o1.startDate).getTime();
          const e1 = new Date(o1.endDate).getTime();
          const s2 = new Date(o2.startDate).getTime();
          const e2 = new Date(o2.endDate).getTime();

          // Exclusive boundary overlap check: S1 < E2 && S2 < E1
          if (s1 < e2 && s2 < e1) {
            adj[i].push(j);
            adj[j].push(i);
          }
        }
      }

      // 3. Find connected components using BFS
      const visited = new Set<number>();
      const components: number[][] = [];

      for (let i = 0; i < n; i++) {
        if (!visited.has(i)) {
          const component: number[] = [];
          const queue = [i];
          visited.add(i);

          while (queue.length > 0) {
            const curr = queue.shift()!;
            component.push(curr);

            for (const neighbor of adj[curr]) {
              if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
              }
            }
          }
          components.push(component);
        }
      }

      // 4. Reschedule overlapping components
      const updates: { id: string; startDate: string; endDate: string }[] = [];
      const rescheduledOrders: ProductionOrder[] = [];

      for (const component of components) {
        // Only reschedule components with 2 or more overlapping orders
        if (component.length < 2) {
          continue;
        }

        // Sort orders in this component by createdAt ascending (tie-breaker: reference)
        const sortedOrders = component
          .map((idx) => orders[idx])
          .sort((a, b) => {
            const tA = new Date(a.createdAt).getTime();
            const tB = new Date(b.createdAt).getTime();
            if (tA !== tB) {
              return tA - tB;
            }
            return a.reference.localeCompare(b.reference);
          });

        // Find the earliest start time among the component's orders
        const minStart = Math.min(
          ...sortedOrders.map((o) => new Date(o.startDate).getTime()),
        );

        let currentTime = minStart;

        for (const order of sortedOrders) {
          const start = new Date(order.startDate).getTime();
          const end = new Date(order.endDate).getTime();
          const duration = end - start;

          const newStart = new Date(currentTime);
          const newEnd = new Date(currentTime + duration);

          // Update the order dates
          const updatedStartDate = newStart.toISOString();
          const updatedEndDate = newEnd.toISOString();

          // Only add to updates if the dates actually changed
          if (
            order.startDate !== updatedStartDate ||
            order.endDate !== updatedEndDate
          ) {
            updates.push({
              id: order.id,
              startDate: updatedStartDate,
              endDate: updatedEndDate,
            });

            // Create a copy of the updated order for the return value
            rescheduledOrders.push({
              ...order,
              startDate: updatedStartDate,
              endDate: updatedEndDate,
            });
          } else {
            // Keep track of the original even if unchanged in value (it is part of the sequence)
            rescheduledOrders.push(order);
          }

          currentTime += duration;
        }
      }

      // 5. Apply updates in bulk to Directus
      if (updates.length > 0) {
        this.logger.log(`Rescheduling completed. Saving ${updates.length} updates to Directus.`);
        await axios.patch(`${this.directusUrl}/items/production_orders`, updates);
      } else {
        this.logger.log('Rescheduling completed. No dates were changed.');
      }

      return rescheduledOrders;
    } catch (error) {
      this.logger.error('Error during planned orders rescheduling:', error.message);
      if (error.response && error.response.data) {
        this.logger.error('Details:', JSON.stringify(error.response.data));
      }
      throw error;
    }
  }
}
