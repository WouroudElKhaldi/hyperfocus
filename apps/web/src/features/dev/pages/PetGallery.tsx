import { PET_AGE_COUNT, PET_SPECIES } from "@hyperfocus/shared/constants";
import { useApi } from "../../../api/hooks.ts";
import { PetArt } from "../../pet/index.ts";

// Every pet drawing on one page (P3-15), development only: each species at every age, both builds, and every item,
// pattern and aura from the catalog. The visual test screenshots it, so any change to the art shows up pixel by pixel.

const SPECIES = PET_SPECIES;
const AGES = Array.from({ length: PET_AGE_COUNT }, (_, i) => i);
const MOODS = ["happy", "calm", "sleepy", "proud"];
const still = { animate: false, size: 96 } as const;

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure style={{ margin: 0, textAlign: "center", width: 104 }}>
      {children}
      <figcaption style={{ fontSize: 11 }}>{label}</figcaption>
    </figure>
  );
}
const Row = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: 16 }}>
    <h2 style={{ fontSize: 14, margin: "0 0 4px" }}>{title}</h2>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{children}</div>
  </section>
);

export default function PetGallery() {
  const catalog = useApi("/pet/catalog").data;
  return (
    <div data-testid="pet-gallery" style={{ background: "#fff", color: "#000", padding: 8 }}>
      <h1 style={{ fontSize: 18 }}>Pet gallery</h1>
      {SPECIES.map((species) => (
        <Row key={species} title={`${species}: every age, then legend`}>
          {AGES.map((stage) => <Cell key={stage} label={`age ${stage}`}><PetArt {...still} species={species} stage={stage} eggProgress={0.5} /></Cell>)}
          <Cell label="legend"><PetArt {...still} species={species} stage={9} legend /></Cell>
        </Row>
      ))}
      <Row title="builds and moods (adult)">
        {SPECIES.flatMap((species) => ["boy", "girl"].map((gender) => <Cell key={species + gender} label={`${species} ${gender}`}><PetArt {...still} species={species} gender={gender} stage={9} /></Cell>))}
        {MOODS.map((mood) => <Cell key={mood} label={mood}><PetArt {...still} stage={6} mood={mood} /></Cell>)}
      </Row>
      {catalog && (
        <>
          <Row title="every item (adult cat)">
            {catalog.items.map((item) => (
              <Cell key={item.id} label={item.id}>
                <PetArt {...still} stage={9} gender={item.for === "boy" ? "boy" : "girl"} outfit={{ [item.slot ?? "head"]: item.id }} />
              </Cell>
            ))}
          </Row>
          <Row title="patterns and auras">
            {catalog.patterns.map((p) => <Cell key={p.id} label={p.id}><PetArt {...still} stage={9} pattern={p.id} /></Cell>)}
            {catalog.auras.map((a) => <Cell key={a.id} label={a.id}><PetArt {...still} stage={9} aura={a.id} /></Cell>)}
          </Row>
        </>
      )}
    </div>
  );
}
