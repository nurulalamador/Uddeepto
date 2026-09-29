"use client";

import { useEffect, useState } from "react";
import { Edit3, Plus, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useUser } from "../shell";
import {
  Badge,
  Heading,
  InterestIcon,
  Modal,
  SearchBox,
  State,
  useResource,
} from "../ui";
import { FindPerson } from "./messages";

export default function Profile() {
  const user = useUser();
  const params = useSearchParams();
  const isLearner = user.role === "learner";
  const [selected, setSelected] = useState(params.get("user") || user.id);
  const [finding, setFinding] = useState(false);
  const [edit, setEdit] = useState(false);
  const resource = useResource(`frontend/profile/${selected}`);

  return (
    <>
      {!isLearner && (
        <Heading
          eyebrow="PEOPLE BEHIND THE POSSIBILITIES"
          title="Profile"
          description="Your interests. Your work. Your story."
        >
          <button className="button secondary" onClick={() => setFinding(true)}>
            <Search size={18} /> Find a person
          </button>
        </Heading>
      )}
      {isLearner && (
        <div className="workspace-page-actions">
          <button className="button secondary" onClick={() => setFinding(true)}>
            <Search size={18} /> Find a person
          </button>
        </div>
      )}

      <State resource={resource}>
        {resource.data && (
          <>
            <div className="profile-card card">
              <div className="profile-cover">
                {resource.data.has_cover_image && (
                  <img src={`/api/backend/frontend/profile/${resource.data.id}/cover`} alt="" />
                )}
              </div>
              <div className="profile-info">
                <span className="avatar profile-avatar">
                  {resource.data.has_picture ? (
                    <img src={`/api/backend/frontend/profile/${resource.data.id}/picture`} alt="" />
                  ) : resource.data.name?.[0]}
                </span>
                <div>
                  <h1>{resource.data.name}</h1>
                  <p>@{resource.data.username}</p>
                </div>
                <Badge>{resource.data.role}</Badge>
                {selected === user.id && (
                  <button
                    className="button secondary"
                    onClick={() => setEdit(true)}
                  >
                    <Edit3 size={16} /> Edit profile
                  </button>
                )}
              </div>
              <div className="profile-bio">
                <h3>About</h3>
                <p className="preserve">
                  {resource.data.bio || "A new story is taking shape. No bio yet."}
                </p>
                <h3>Interests</h3>
                <div className="row wrap">
                  {resource.data.interests?.length ? (
                    resource.data.interests.map((interest) => (
                      <Badge key={interest.id}>{interest.name}</Badge>
                    ))
                  ) : (
                    <p>No interests added yet.</p>
                  )}
                </div>
              </div>
            </div>
            <h2 className="section-title">Recent showcase</h2>
            <div className="grid two">
              {resource.data.posts?.map((post) => (
                <article className="card" key={post.id}>
                  <p className="preserve">{post.content}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </State>

      {finding && (
        <Modal title="Explore profiles" onClose={() => setFinding(false)}>
          <FindPerson
            onSelect={(person) => {
              setSelected(person.id);
              setFinding(false);
            }}
          />
        </Modal>
      )}
      {edit && (
        <Modal title="Edit your profile" onClose={() => setEdit(false)}>
          <EditProfile
            profile={resource.data}
            onDone={() => {
              setEdit(false);
              resource.reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}

function EditProfile({ profile, onDone }) {
  const categoriesResource = useResource("users/interests");
  const [interests, setInterests] = useState(
    profile.interests?.map((interest) => String(interest.id)) || [],
  );
  const [interestSearch, setInterestSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [picturePreview, setPicturePreview] = useState(profile.has_picture ? `/api/backend/frontend/profile/${profile.id}/picture` : "");
  const [coverPreview, setCoverPreview] = useState(profile.has_cover_image ? `/api/backend/frontend/profile/${profile.id}/cover` : "");
  const [removePicture, setRemovePicture] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const categories = categoriesResource.data || [];
  const selectedCategories = categories.filter((category) =>
    interests.includes(String(category.id)),
  );
  const availableCategories = categories.filter(
    (category) =>
      !interests.includes(String(category.id)) &&
      category.name.toLowerCase().includes(interestSearch.trim().toLowerCase()),
  );

  useEffect(() => () => {
    if (picturePreview.startsWith("blob:")) URL.revokeObjectURL(picturePreview);
    if (coverPreview.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
  }, [picturePreview, coverPreview]);

  function addInterest(id) {
    setInterests((current) =>
      current.includes(String(id)) ? current : [...current, String(id)],
    );
  }

  function removeInterest(id) {
    setInterests((current) => current.filter((value) => value !== String(id)));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = new FormData(event.currentTarget);
      body.set("interest_ids", JSON.stringify(interests));
      body.set("remove_picture", String(removePicture));
      body.set("remove_cover_image", String(removeCover));
      if (removePicture) body.delete("picture");
      if (removeCover) body.delete("cover_image");
      await api("frontend/profile", {
        method: "PATCH",
        body,
      });
      onDone();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Name
        <input name="name" required defaultValue={profile.name} maxLength={150} />
      </label>
      <label>
        Username
        <input
          name="username"
          required
          defaultValue={profile.username}
          pattern="[A-Za-z0-9_.-]{3,40}"
        />
      </label>
      <label>
        Bio
        <textarea
          name="bio"
          defaultValue={profile.bio || ""}
          rows={5}
          maxLength={3000}
        />
      </label>

      <div className="profile-media-grid">
        <section className="profile-media-control">
          <h4>Profile picture</h4>
          {picturePreview && !removePicture ? (
            <img className="profile-picture-preview" src={picturePreview} alt="Profile picture preview" />
          ) : (
            <span className="profile-picture-placeholder">{profile.name?.[0]}</span>
          )}
          <label className="profile-media-button">
            Choose picture
            <input type="file" name="picture" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setRemovePicture(false);
              setPicturePreview(URL.createObjectURL(file));
            }} />
          </label>
          {profile.has_picture && <button type="button" className="profile-media-remove" onClick={() => setRemovePicture((value) => !value)}>{removePicture ? "Keep current picture" : "Remove picture"}</button>}
        </section>
        <section className="profile-media-control">
          <h4>Cover image</h4>
          {coverPreview && !removeCover ? <img className="profile-cover-preview" src={coverPreview} alt="Cover preview" /> : <div className="profile-cover-placeholder" />}
          <label className="profile-media-button">
            Choose cover
            <input type="file" name="cover_image" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setRemoveCover(false);
              setCoverPreview(URL.createObjectURL(file));
            }} />
          </label>
          {profile.has_cover_image && <button type="button" className="profile-media-remove" onClick={() => setRemoveCover((value) => !value)}>{removeCover ? "Keep current cover" : "Remove cover"}</button>}
        </section>
      </div>

      <fieldset className="interest-picker">
        <legend>Interests</legend>
        <section className="interest-picker-section">
          <div className="interest-picker-heading">
            <h4>Selected interests</h4>
            <span>{selectedCategories.length} selected</span>
          </div>
          <div className="interest-chip-list">
            {selectedCategories.length ? (
              selectedCategories.map((category) => (
                <div className="interest-chip selected" key={category.id}>
                  <InterestIcon iconName={category.icon} size={17} />
                  <span>{category.name}</span>
                  <button
                    type="button"
                    className="interest-chip-remove"
                    aria-label={`Remove ${category.name}`}
                    title={`Remove ${category.name}`}
                    onClick={() => removeInterest(category.id)}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))
            ) : (
              <p className="interest-picker-empty">
                No interests selected yet. Add one below.
              </p>
            )}
          </div>
        </section>

        <section className="interest-picker-section">
          <div className="interest-picker-heading">
            <h4>Explore interests</h4>
            <span>{availableCategories.length} available</span>
          </div>
          <SearchBox
            value={interestSearch}
            onChange={setInterestSearch}
            placeholder="Search interests…"
          />
          <div className="interest-chip-list">
            {availableCategories.length ? (
              availableCategories.map((category) => (
                <button
                  type="button"
                  className="interest-chip available"
                  key={category.id}
                  onClick={() => addInterest(category.id)}
                >
                  <InterestIcon iconName={category.icon} size={17} />
                  <span>{category.name}</span>
                  <Plus size={15} className="interest-chip-add" />
                </button>
              ))
            ) : (
              <p className="interest-picker-empty">
                {interestSearch
                  ? "No interests match your search."
                  : "You’ve selected every available interest."}
              </p>
            )}
          </div>
        </section>
      </fieldset>

      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <button className="button" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
