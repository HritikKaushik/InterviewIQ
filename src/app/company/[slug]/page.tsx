import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { Explorer } from "@/components/explorer";
import { ExplorerSkeleton } from "@/components/explorer-skeleton";
import { getCompanyData } from "@/lib/company-data";
import { companies, companyBySlug } from "@/lib/dataset";
import { formatCount } from "@/lib/format";

/** Every company is prerendered, so navigation between them is instant. */
export function generateStaticParams() {
  return companies.map((company) => ({ slug: company.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: PageProps<"/company/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const company = companyBySlug.get(slug);
  if (!company) return { title: "Company not found" };

  const description =
    company.total > 0
      ? `${formatCount(company.total)} LeetCode questions reported for ${company.name} interviews: ${company.breakdown[0]} easy, ${company.breakdown[1]} medium, ${company.breakdown[2]} hard. Search, filter by recency, and track your progress.`
      : `${company.name} has no questions in the dataset yet.`;

  return {
    title: `${company.name} LeetCode Questions`,
    description,
    alternates: { canonical: `/company/${company.slug}` },
    openGraph: {
      title: `${company.name} - Company-wise LeetCode Questions`,
      description,
    },
  };
}

export default async function CompanyPage({ params }: PageProps<"/company/[slug]">) {
  const { slug } = await params;
  const company = companyBySlug.get(slug);
  const data = company ? getCompanyData(slug) : null;
  if (!company || !data) notFound();

  return (
    <AppShell activeSlug={slug}>
      <Suspense fallback={<ExplorerSkeleton />}>
        <Explorer variant="company" company={company} periods={data.periods} />
      </Suspense>
    </AppShell>
  );
}
