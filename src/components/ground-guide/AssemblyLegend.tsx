import type { AssemblyGroup } from "@/lib/ground-guide/navigation";
import styles from "./guide.module.css";

export function AssemblyLegend({ groups, highlightedGroup }: { groups: AssemblyGroup[]; highlightedGroup?: string }) {
  return <div className={styles.legend}>
    <h3>この競技の集合区分</h3>
    <ul>{groups.map((group,index)=><li key={group.id} data-own={group.id===highlightedGroup}>
      <span className={styles.groupKey}>{String.fromCharCode(65+index)}</span>
      <div><strong>{group.label}{group.id===highlightedGroup && <span className={styles.ownBadge}>自分の区分</span>}</strong><p>{group.description}</p></div>
    </li>)}</ul>
  </div>;
}
