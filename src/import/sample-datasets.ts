export interface SampleDataset {
  label: string;
  path: string;
}

export const SAMPLE_DATASETS: SampleDataset[] = [
  { label: "Freelancer", path: "/sample-freelancer.csv" },
  { label: "Agency", path: "/sample-agency.csv" },
  { label: "Founder", path: "/sample-founder.csv" }
];
