export default function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">
          {eyebrow}
          <i className="coral-dot" />
        </p>
        <h1>
          {title} <span>*</span>
        </h1>
        <p>{subtitle}</p>
      </div>
      {action && <div className="heading-actions">{action}</div>}
    </div>
  );
}
