import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface AddressComponents {
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (components: AddressComponents) => void;
  placeholder?: string;
  apiKey: string;
  types?: string[];
}

function extractComponents(place: any): AddressComponents {
  const components: AddressComponents = { rua: "", bairro: "", cidade: "", estado: "", cep: "" };
  const parts = place.address_components || [];
  let streetNumber = "";

  for (const c of parts) {
    const types: string[] = c.types;
    if (types.includes("route")) components.rua = c.long_name;
    if (types.includes("street_number")) streetNumber = c.long_name;
    if (types.includes("sublocality_level_1") || types.includes("sublocality") || types.includes("neighborhood")) components.bairro = c.long_name;
    if (types.includes("locality") || types.includes("administrative_area_level_2")) {
      if (!components.cidade) components.cidade = c.long_name;
    }
    if (types.includes("administrative_area_level_1")) components.estado = c.short_name;
    if (types.includes("postal_code")) components.cep = c.long_name;
  }

  if (streetNumber && components.rua) {
    components.rua = `${components.rua}, ${streetNumber}`;
  }

  return components;
}

function getSelectedLabel(place: any, input: HTMLInputElement | null) {
  return String(place?.formatted_address || place?.name || input?.value || "").trim();
}

function applyFallbackComponents(components: AddressComponents, selectedLabel: string) {
  if (!selectedLabel) return components;

  const next = { ...components };
  const pieces = selectedLabel.split(",").map((part) => part.trim()).filter(Boolean);

  if (!next.cidade && pieces[0]) {
    next.cidade = pieces[0];
  }

  if (!next.estado) {
    const stateMatch = selectedLabel.match(/\b([A-Z]{2})\b/);
    if (stateMatch) next.estado = stateMatch[1];
  }

  if (!next.cep) {
    const cepMatch = selectedLabel.match(/\b\d{5}-?\d{3}\b/);
    if (cepMatch) next.cep = cepMatch[0];
  }

  return next;
}

const AddressAutocomplete = ({ value, onChange, onAddressSelect, placeholder = "Digite o endereço...", apiKey, types = ["geocode"] }: AddressAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    if ((window as any).google?.maps?.places) {
      setLoaded(true);
      return;
    }

    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      existing.addEventListener("load", () => setLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, [apiKey]);

  useEffect(() => {
    if (!loaded || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new (window as any).google.maps.places.Autocomplete(inputRef.current, {
      types,
      fields: ["address_components", "formatted_address", "geometry", "name", "place_id"],
      componentRestrictions: { country: "br" },
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place) return;

      const selectedLabel = getSelectedLabel(place, inputRef.current);

      if (onAddressSelect) {
        const components = applyFallbackComponents(extractComponents(place), selectedLabel);
        onAddressSelect(components);
        onChange(components.rua || components.cidade || components.cep || selectedLabel);
      } else if (place.formatted_address) {
        onChange(place.formatted_address);
      } else if (place.name) {
        onChange(place.name);
      } else if (selectedLabel) {
        onChange(selectedLabel);
      }
    });

    autocompleteRef.current = autocomplete;
  }, [loaded, onChange, onAddressSelect]);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={loaded ? placeholder : "Carregando autocomplete..."}
      className="bg-background"
    />
  );
};

export default AddressAutocomplete;
