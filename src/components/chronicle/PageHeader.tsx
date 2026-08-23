import ChroniclePageHeader from '@/chronicle/brand/ChroniclePageHeader';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  hideHome?: boolean;
  hideSettings?: boolean;
  hideMountain?: boolean;
}

const PageHeader = ({ title, subtitle, children }: PageHeaderProps) => (
  <div className="px-5 pt-8 pb-1">
    <ChroniclePageHeader
      title={title}
      subtitle={subtitle}
      eyebrow="Chronicle workspace"
      actions={children}
    />
  </div>
);

export default PageHeader;
