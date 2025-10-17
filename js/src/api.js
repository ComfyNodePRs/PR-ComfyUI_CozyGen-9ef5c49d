const BASE_URL = '/cozygen';

export const getWorkflows = async () => {
  const response = await fetch(`${BASE_URL}/workflows`);
  if (!response.ok) {
    throw new Error('Failed to fetch workflows');
  }
  return response.json();
};

export const getWorkflow = async (filename) => {
  const response = await fetch(`${BASE_URL}/workflows/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch workflow: ${filename}`);
  }
  return response.json();
};

export const queuePrompt = async (prompt) => {
    const response = await fetch(window.location.protocol + '//' + window.location.host + '/prompt', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(prompt)
    });
    if (!response.ok) {
        throw new Error('Failed to queue prompt');
    }
    return response.json();
};

export const getGallery = async (subfolder = '', page = 1, pageSize = 20, showHidden = false) => {
    const response = await fetch(`/cozygen/gallery?subfolder=${encodeURIComponent(subfolder)}&page=${page}&per_page=${pageSize}&show_hidden=${showHidden}`);
    if (!response.ok) {
        throw new Error('Failed to fetch gallery items');
    }
    return response.json();
};

export const getChoices = async (type) => {
  const response = await fetch(`${BASE_URL}/get_choices?type=${encodeURIComponent(type)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch choices for type: ${type}`);
  }
  return response.json();
};

export const uploadImage = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch(`${BASE_URL}/upload_image`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload image');
  }
  return response.json();
};

export const toggleFolderVisibility = async (folder) => {
  const response = await fetch(`${BASE_URL}/toggle_folder_visibility`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ folder }),
  });
  if (!response.ok) {
    throw new Error('Failed to toggle folder visibility');
  }
  return response.json();
};

export const submitJob = async (payload) => {
  const response = await fetch(`${BASE_URL}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('Failed to submit job');
  }
  return response.json();
};

export const getQueue = async () => {
  const response = await fetch(`${BASE_URL}/queue`);
  if (!response.ok) {
    throw new Error('Failed to fetch queue');
  }
  return response.json();
};

export const fetchImageBlob = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Failed to fetch image data');
    }
    const blob = await response.blob();
    return blob;
};

export const getPresets = async (workflow) => {
  const response = await fetch(`${BASE_URL}/presets?workflow=${encodeURIComponent(workflow)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch presets');
  }
  return response.json();
};

export const getPreset = async (workflow, preset) => {
  const response = await fetch(`${BASE_URL}/presets/${encodeURIComponent(workflow)}/${encodeURIComponent(preset)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch preset');
  }
  return response.json();
};

export const savePreset = async (workflow, presetName, formData) => {
  const response = await fetch(`${BASE_URL}/presets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workflow, preset_name: presetName, form_data: formData }),
  });
  if (!response.ok) {
    throw new Error('Failed to save preset');
  }
  return response.json();
};

export const deletePreset = async (workflow, presetName) => {
  const response = await fetch(`${BASE_URL}/presets`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workflow, preset_name: presetName }),
  });
  if (!response.ok) {
    throw new Error('Failed to delete preset');
  }
  return response.json();
};