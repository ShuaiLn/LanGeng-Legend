// Static disclaimer, rendered once by the root layout: stays a Server Component.
export default function Footer() {
  return (
    <footer className="border-t border-border/60 bg-surface/60 px-4 py-4 text-center text-xs text-muted">
      本作品为粉丝同人，和原作公司无关，所有角色版权归各自原作者
    </footer>
  );
}
