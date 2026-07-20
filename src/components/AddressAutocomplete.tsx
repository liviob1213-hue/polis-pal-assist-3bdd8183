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
    if (types.includes("sublocality_level_1") || types.includes("sublocality")) components.bairro = c.long_name;
    if (types.includes("administrative_area_level_2")) components.cidade = c.long_name;
    if (types.includes("administrative_area_level_1")) components.estado = c.short_name;
    if (types.includes("postal_code")) components.cep = c.long_name;
  }

  if (streetNumber && components.rua) {
    components.rua = `${components.rua}, ${streetNumber}`;
  }

  return components;
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
      types: ["address"],
      componentRestrictions: { country: "br" },
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place) return;

      if (onAddressSelect) {
        const components = extractComponents(place);
        onAddressSelect(components);
        onChange(components.rua);
      } else if (place.formatted_address) {
        onChange(place.formatted_address);
      } else if (place.name) {
        onChange(place.name);
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
