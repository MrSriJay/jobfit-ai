import { Plus, Save, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { usePreferences } from "../preferences";
import type { CandidateProfile, CertificationItem, EducationItem, ExperienceItem, ProjectItem } from "../types";

function unique(parts: string[], casefold = true): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const part of parts) {
    const value = part.trim().replace(/^[-•\s]+/, "");
    if (!value) continue;
    const key = casefold ? value.toLocaleLowerCase() : value;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(value);
  }
  return items;
}

function tokens(value: string): string[] {
  return unique(value.split(/[,|\n]+/));
}

function textList(value: string | string[], separator: RegExp): string[] {
  const parts = Array.isArray(value) ? value : [value];
  return parts.flatMap((item) => item.split(separator)).map((item) => item.trim()).filter(Boolean);
}

const tabs = [
  { id: "about", label: "About" },
  { id: "skills", label: "Skills" },
  { id: "experience", label: "Experience" },
  { id: "education", label: "Education" },
  { id: "projects", label: "Projects" },
  { id: "certificates", label: "Certificates" },
] as const;

type ProfileTab = (typeof tabs)[number]["id"];

export function ProfileForm({
  profile,
  onSave,
  next,
}: {
  profile: CandidateProfile;
  onSave: (profile: CandidateProfile) => void;
  next?: ReactNode;
}) {
  const { m } = usePreferences();
  const [draft, setDraft] = useState(() => ({
    ...profile,
    phone: textList(profile.phone, /\s*(?:;|\||\n|\/)\s*/),
    links: textList(profile.links, /\n+/),
  }));
  const [tab, setTab] = useState<ProfileTab>("about");

  const save = () => {
    onSave({
      ...draft,
      name: draft.name.trim(),
      email: draft.email.trim(),
      phone: unique(draft.phone),
      location: draft.location.trim(),
      links: unique(draft.links, false),
      professionalSummary: draft.professionalSummary.trim(),
      skills: tokens(draft.skills.join("\n")),
      technologies: tokens(draft.technologies.join("\n")),
      experience: draft.experience
        .map((item) => ({
          ...item,
          title: item.title.trim(),
          company: item.company.trim(),
          start: item.start.trim(),
          end: item.end.trim(),
          highlights: item.highlights.map((line) => line.trim()).filter(Boolean),
        }))
        .filter((item) => item.title || item.company || item.highlights.length),
      education: draft.education.filter((item) => item.degree.trim() || item.institution.trim()),
      projects: draft.projects.filter((item) => item.name.trim() || item.description.trim()),
      certifications: draft.certifications.filter((item) => item.name.trim()),
    });
  };

  const counts: Partial<Record<ProfileTab, number>> = {
    experience: draft.experience.length,
    education: draft.education.length,
    projects: draft.projects.length,
    certificates: draft.certifications.length,
  };

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="tabs profile-tabs" role="tablist" aria-label={m.profile.sections}>
        {tabs.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {m.profile[item.id]}
            {counts[item.id] ? <span className="tab-count">{counts[item.id]}</span> : null}
          </button>
        ))}
      </div>

      {tab === "about" ? (
        <div className="stack">
          <div className="grid-2">
            <Field label={m.profile.name} value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
            <Field label={m.profile.email} value={draft.email} onChange={(email) => setDraft({ ...draft, email })} />
          </div>
          <Field label={m.profile.location} value={draft.location} onChange={(location) => setDraft({ ...draft, location })} />
          <EntryList
            label={m.profile.phone}
            addLabel={m.profile.addPhone}
            placeholder="+94 ..."
            values={draft.phone}
            onChange={(phone) => setDraft({ ...draft, phone })}
          />
          <EntryList
            label={m.profile.links}
            addLabel={m.profile.addLink}
            placeholder="https://"
            values={draft.links}
            onChange={(links) => setDraft({ ...draft, links })}
          />
          <Area label={m.profile.summary} value={draft.professionalSummary} onChange={(professionalSummary) => setDraft({ ...draft, professionalSummary })} />
        </div>
      ) : null}

      {tab === "skills" ? (
        <div className="grid-2">
          <Area label={m.profile.skills} hint={m.profile.skillsHint} value={draft.skills.join("\n")} onChange={(value) => setDraft({ ...draft, skills: value.split("\n") })} />
          <Area label={m.profile.tools} hint={m.profile.toolsHint} value={draft.technologies.join("\n")} onChange={(value) => setDraft({ ...draft, technologies: value.split("\n") })} />
        </div>
      ) : null}

      {tab === "experience" ? (
        <div className="stack">
          {draft.experience.length === 0 ? <p className="fine">{m.profile.noRoles}</p> : null}
          {draft.experience.map((item, index) => (
            <ExperienceEditor
              key={index}
              index={index}
              item={item}
              onChange={(nextItem) => setDraft({ ...draft, experience: draft.experience.map((row, rowIndex) => (rowIndex === index ? nextItem : row)) })}
              onRemove={() => setDraft({ ...draft, experience: draft.experience.filter((_, rowIndex) => rowIndex !== index) })}
            />
          ))}
          <AddButton label={m.profile.addRole} onClick={() => setDraft({ ...draft, experience: [...draft.experience, { title: "", company: "", start: "", end: "", highlights: [] }] })} />
        </div>
      ) : null}

      {tab === "education" ? (
        <div className="stack">
          {draft.education.length === 0 ? <p className="fine">{m.profile.noEducation}</p> : null}
          {draft.education.map((item, index) => (
            <EducationEditor
              key={index}
              index={index}
              item={item}
              onChange={(nextItem) => setDraft({ ...draft, education: draft.education.map((row, rowIndex) => (rowIndex === index ? nextItem : row)) })}
              onRemove={() => setDraft({ ...draft, education: draft.education.filter((_, rowIndex) => rowIndex !== index) })}
            />
          ))}
          <AddButton label={m.profile.addEducation} onClick={() => setDraft({ ...draft, education: [...draft.education, { degree: "", institution: "", dates: "", details: "" }] })} />
        </div>
      ) : null}

      {tab === "projects" ? (
        <div className="stack">
          {draft.projects.length === 0 ? <p className="fine">{m.profile.noProjects}</p> : null}
          {draft.projects.map((item, index) => (
            <ProjectEditor
              key={index}
              index={index}
              item={item}
              onChange={(nextItem) => setDraft({ ...draft, projects: draft.projects.map((row, rowIndex) => (rowIndex === index ? nextItem : row)) })}
              onRemove={() => setDraft({ ...draft, projects: draft.projects.filter((_, rowIndex) => rowIndex !== index) })}
            />
          ))}
          <AddButton label={m.profile.addProject} onClick={() => setDraft({ ...draft, projects: [...draft.projects, { name: "", description: "", technologies: [] }] })} />
        </div>
      ) : null}

      {tab === "certificates" ? (
        <div className="stack">
          {draft.certifications.length === 0 ? <p className="fine">{m.profile.noCertificates}</p> : null}
          {draft.certifications.map((item, index) => (
            <CertificationEditor
              key={index}
              index={index}
              item={item}
              onChange={(nextItem) => setDraft({ ...draft, certifications: draft.certifications.map((row, rowIndex) => (rowIndex === index ? nextItem : row)) })}
              onRemove={() => setDraft({ ...draft, certifications: draft.certifications.filter((_, rowIndex) => rowIndex !== index) })}
            />
          ))}
          <AddButton label={m.profile.addCertificate} onClick={() => setDraft({ ...draft, certifications: [...draft.certifications, { name: "", issuer: "", date: "" }] })} />
        </div>
      ) : null}

      <div className={next ? "form-actions" : undefined}>
        <button className={next ? "btn ghost" : "btn primary wide"} type="submit">
          <Save size={16} /> {m.profile.save}
        </button>
        {next}
      </div>
    </form>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="btn ghost" type="button" onClick={onClick}>
      <Plus size={16} /> {label}
    </button>
  );
}

function EntryList({
  label,
  addLabel,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  addLabel: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const { m } = usePreferences();
  return (
    <div className="entry-list">
      <span>{label}</span>
      {values.length === 0 ? <p className="fine">{m.profile.none}</p> : null}
      {values.map((value, index) => (
        <div className="entry-line" key={index}>
          <input
            value={value}
            placeholder={placeholder}
            aria-label={`${label} ${index + 1}`}
            onChange={(event) => onChange(values.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
          />
          <Remove onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} />
        </div>
      ))}
      <AddButton label={addLabel} onClick={() => onChange([...values, ""])} />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Area({ label, hint, value, onChange, rows = 5 }: { label: string; hint?: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function Entry({ index, onRemove, children }: { index: number; onRemove: () => void; children: ReactNode }) {
  return (
    <article className="entry">
      <span className="entry-index">{index + 1}</span>
      <div className="entry-body">{children}</div>
      <Remove onClick={onRemove} />
    </article>
  );
}

function Remove({ onClick }: { onClick: () => void }) {
  const { m } = usePreferences();
  return (
    <button className="btn tiny ghost" type="button" onClick={onClick} aria-label={m.profile.remove}>
      <Trash2 size={14} />
    </button>
  );
}

function ExperienceEditor({ index, item, onChange, onRemove }: { index: number; item: ExperienceItem; onChange: (item: ExperienceItem) => void; onRemove: () => void }) {
  const { m } = usePreferences();
  return (
    <Entry index={index} onRemove={onRemove}>
      <div className="entry-grid">
        <Field label={m.profile.title} value={item.title} onChange={(title) => onChange({ ...item, title })} />
        <Field label={m.profile.company} value={item.company} onChange={(company) => onChange({ ...item, company })} />
      </div>
      <div className="entry-grid">
        <Field label={m.profile.start} value={item.start} onChange={(start) => onChange({ ...item, start })} />
        <Field label={m.profile.end} value={item.end} onChange={(end) => onChange({ ...item, end })} />
      </div>
      <Area label={m.profile.highlights} hint={m.profile.highlightsHint} rows={3} value={item.highlights.join("\n")} onChange={(value) => onChange({ ...item, highlights: value.split("\n") })} />
    </Entry>
  );
}

function EducationEditor({ index, item, onChange, onRemove }: { index: number; item: EducationItem; onChange: (item: EducationItem) => void; onRemove: () => void }) {
  const { m } = usePreferences();
  return (
    <Entry index={index} onRemove={onRemove}>
      <div className="entry-grid degrees">
        <Field label={m.profile.degree} value={item.degree} onChange={(degree) => onChange({ ...item, degree })} />
        <Field label={m.profile.dates} value={item.dates} onChange={(dates) => onChange({ ...item, dates })} />
      </div>
      <Field label={m.profile.institution} value={item.institution} onChange={(institution) => onChange({ ...item, institution })} />
      <Field label={m.profile.details} value={item.details} onChange={(details) => onChange({ ...item, details })} />
    </Entry>
  );
}

function ProjectEditor({ index, item, onChange, onRemove }: { index: number; item: ProjectItem; onChange: (item: ProjectItem) => void; onRemove: () => void }) {
  const { m } = usePreferences();
  return (
    <Entry index={index} onRemove={onRemove}>
      <Field label={m.profile.projectName} value={item.name} onChange={(name) => onChange({ ...item, name })} />
      <Area label={m.profile.description} rows={3} value={item.description} onChange={(description) => onChange({ ...item, description })} />
      <Area label={m.profile.technologies} hint={m.profile.techHint} rows={2} value={item.technologies.join("\n")} onChange={(value) => onChange({ ...item, technologies: value.split(/[,|\n]+/) })} />
    </Entry>
  );
}

function CertificationEditor({ index, item, onChange, onRemove }: { index: number; item: CertificationItem; onChange: (item: CertificationItem) => void; onRemove: () => void }) {
  const { m } = usePreferences();
  return (
    <Entry index={index} onRemove={onRemove}>
      <div className="entry-grid certs">
        <Field label={m.profile.name} value={item.name} onChange={(name) => onChange({ ...item, name })} />
        <Field label={m.profile.issuer} value={item.issuer} onChange={(issuer) => onChange({ ...item, issuer })} />
        <Field label={m.profile.date} value={item.date} onChange={(date) => onChange({ ...item, date })} />
      </div>
    </Entry>
  );
}
